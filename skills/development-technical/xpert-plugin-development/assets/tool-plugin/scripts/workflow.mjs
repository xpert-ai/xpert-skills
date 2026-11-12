// Paired-source development may use host tools; clean archive verification must not inherit NODE_PATH.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2), command = args.shift()
const platformIndex = args.indexOf('--platform')
const platform = platformIndex < 0 ? null : resolve(args.splice(platformIndex, 2)[1])
const toolRoot = platform ?? root
const requireTool = createRequire(join(toolRoot, 'package.json'))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const buildRoot = join(root, '.xpert-build')

function run(binary, parameters, options = {}) {
  const result = spawnSync(binary, parameters, { cwd: root, stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${binary} failed with ${result.signal ?? result.status}`)
  return result
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : []
  })
}
function hostPackage(name) {
  if (!platform) return dirname(requireTool.resolve(`${name}/package.json`))
  return join(platform, 'packages', name === '@xpert-ai/plugin-sdk' ? 'plugin-sdk' : 'contracts')
}
function linkHostPeers(target) {
  mkdirSync(join(target, 'node_modules/@xpert-ai'), { recursive: true })
  for (const name of ['@xpert-ai/plugin-sdk', '@xpert-ai/contracts']) {
    const destination = join(target, 'node_modules', name)
    // A production dependency must not be silently replaced by a host link.
    try { statSync(destination); throw new Error(`Unexpected installed host peer: ${name}`) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    symlinkSync(hostPackage(name), destination, 'dir')
  }
}
function compile(includeTests) {
  const ts = requireTool('typescript')
  const configPath = join(root, 'tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  const outDir = join(buildRoot, includeTests ? 'tests-compiled' : 'compiled')
  rmSync(outDir, { recursive: true, force: true })
  const extra = { rootDir: root, outDir, declaration: !includeTests, emitDeclarationOnly: false }
  if (platform) Object.assign(extra, {
    baseUrl: root,
    typeRoots: [join(platform, 'node_modules/@types')],
    paths: {
      '@xpert-ai/plugin-sdk': [join(hostPackage('@xpert-ai/plugin-sdk'), 'dist/index.d.ts')],
      '@xpert-ai/contracts': [join(hostPackage('@xpert-ai/contracts'), 'dist/index.d.ts')],
      '*': [join(platform, 'node_modules/*')]
    }
  })
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, extra, configPath)
  const names = parsed.fileNames.filter(name => includeTests || !name.endsWith('.spec.ts'))
  const program = ts.createProgram(names, parsed.options)
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)]
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n'
  }))
  const result = program.emit()
  if (result.emitSkipped || result.diagnostics.length) throw new Error('TypeScript emit failed')
  return outDir
}
async function bundle(entry, outfile) {
  await requireTool('esbuild').build({ entryPoints: [entry], outfile, bundle: true, platform: 'node',
    target: 'node22', format: 'cjs', packages: 'external', sourcemap: false, logLevel: 'warning' })
}
async function build() {
  const compiled = compile(false)
  rmSync(join(root, 'dist'), { recursive: true, force: true })
  mkdirSync(join(root, 'dist'), { recursive: true })
  await bundle(join(compiled, 'src/index.js'), join(root, 'dist/index.js'))
  for (const path of files(join(compiled, 'src')).filter(path => path.endsWith('.d.ts'))) {
    const target = join(root, 'dist/types', relative(join(compiled, 'src'), path))
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, readFileSync(path))
  }
  console.log(JSON.stringify({ built: 'dist/index.js', sdkMode: platform ? 'paired-source' : 'installed-dependencies' }))
}
async function test() {
  const compiled = compile(true), specs = files(join(compiled, 'src')).filter(path => path.endsWith('.spec.js'))
  if (!specs.length) throw new Error('No functional test files found')
  const directory = join(buildRoot, 'test-runtime')
  rmSync(directory, { recursive: true, force: true }); mkdirSync(directory, { recursive: true })
  if (platform) linkHostPeers(directory)
  const paths = []
  for (const [index, spec] of specs.entries()) {
    const path = join(directory, `${index}.test.cjs`); await bundle(spec, path); paths.push(path)
  }
  console.log('Development test resolution is separate from clean archive verification.')
  run(process.execPath, ['--test', ...paths], { env: { ...process.env,
    ...(platform ? { NODE_PATH: join(platform, 'node_modules') } : {}) } })
}
async function pack() {
  await build()
  mkdirSync(join(root, 'artifacts'), { recursive: true })
  const result = run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', 'artifacts'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  const [packed] = JSON.parse(result.stdout)
  const archive = join(root, 'artifacts', packed.filename)
  const receipt = { name: pkg.name, version: pkg.version, archive: relative(root, archive),
    sha256: createHash('sha256').update(readFileSync(archive)).digest('hex'), files: packed.files.map(file => file.path) }
  writeFileSync(`${archive}.json`, JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify(receipt))
}
function verifyArchive() {
  if (args.length !== 1) throw new Error('verify-archive requires one archive path')
  const archive = resolve(args[0])
  const directory = mkdtempSync(join(tmpdir(), 'xpert-plugin-archive-'))
  const environment = { ...process.env }; delete environment.NODE_PATH
  try {
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'xpert-archive-check', private: true }))
    run('npm', ['install', '--prefix', directory, '--omit=dev', '--omit=peer', '--legacy-peer-deps',
      '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', archive], { cwd: directory, env: environment })
    linkHostPeers(directory)
    const check = `const {createRequire}=require('node:module'); const fs=require('node:fs');
const r=createRequire(process.argv[1]+'/package.json'); const expected=JSON.parse(process.argv[2]);
const m=r(expected.name); const p=m.default??m; const installed=r(expected.name+'/package.json');
for(const [key,value] of Object.entries({name:expected.name,version:expected.version,level:expected.xpert.plugin.level,artifactNamespace:expected.xpert.plugin.artifactNamespace})){
 if(p.meta?.[key]!==value)throw Error('Runtime metadata mismatch: '+key);
}
if(installed.name!==expected.name||installed.version!==expected.version||typeof p.register!=='function')throw Error('Invalid installed plugin');
if(typeof m.ToolProvider!=='function')throw Error('Missing starter tool provider export');
const descriptor=r('@xpert-ai/plugin-sdk').describeXpertToolProvider(Object.create(m.ToolProvider.prototype));
if(!descriptor.tools.length)throw Error('No valid tool descriptors');
Promise.resolve(p.register()).then(result=>{if(typeof result?.module!=='function')throw Error('Missing server module');
console.log(JSON.stringify({archiveImport:true,toolDescriptor:true,name:p.meta.name,version:p.meta.version,hostPeers:['@xpert-ai/plugin-sdk','@xpert-ai/contracts'],livePlatformAcceptance:false}));});`
    run(process.execPath, ['-e', check, directory, JSON.stringify(pkg)], { cwd: directory, env: environment })
  } finally { rmSync(directory, { recursive: true, force: true }) }
}
try {
  if (!['build', 'test', 'pack', 'verify-archive'].includes(command)) throw new Error('Use build, test, pack or verify-archive [archive] [--platform root]')
  if (command !== 'verify-archive' && args.length) throw new Error('Unexpected arguments')
  await ({ build, test, pack, 'verify-archive': verifyArchive })[command]()
} catch (error) { console.error(error.message); process.exitCode = 1 }
