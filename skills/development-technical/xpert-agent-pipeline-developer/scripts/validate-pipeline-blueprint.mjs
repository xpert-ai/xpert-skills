#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const VALID_KEY = /^[a-z][a-z0-9_-]*$/
const VALID_NAMESPACE = /^[a-z][a-z0-9_]*$/
const VALID_CLIENT_COMMAND = /^[a-z][a-z0-9_.-]*$/
const ROLE_KINDS = new Set(['business', 'orchestrator', 'internal_specialist', 'human_only'])
const SURFACES = new Set(['assistant', 'backend', 'workbench'])
const TOPOLOGIES = new Set(['standalone_roles', 'orchestrated_roles', 'both'])
const EXECUTION_MODES = new Set(['assistant_task', 'human', 'system'])
const HUMAN_GATES = new Set(['none', 'review', 'approval', 'external_confirmation'])
const RISKS = new Set(['low', 'medium', 'high', 'irreversible'])
const VIEW_KINDS = new Set(['pipeline_overview', 'node_workspace', 'case_detail', 'operations_dashboard'])
const WORKBENCH_MODES = new Set(['required', 'waived'])
const NODE_OPEN_MODES = new Set(['dialog', 'view', 'component'])
const REFRESH_STRATEGIES = new Set(['manual', 'polling', 'event', 'hybrid'])
const PROJECTION_OPERATIONS = [
  'caseList',
  'caseCreate',
  'caseGet',
  'flowProject',
  'executableNodes',
  'nodeStart',
  'nextNodeProcess',
  'humanTaskComplete',
  'blockerResolve',
  'nodeWorkspaceGet',
  'executionRecordList'
]

function usage() {
  console.log(`Usage:
  node validate-pipeline-blueprint.mjs <pipeline-blueprint.json> [--json]

Validates structural references and cross-layer Xpert pipeline invariants without external dependencies.`)
}

const args = process.argv.slice(2)
if (args.includes('--help') || args.length === 0) {
  usage()
  process.exit(args.length === 0 ? 2 : 0)
}

const jsonOutput = args.includes('--json')
const input = args.find((arg) => !arg.startsWith('--'))
if (!input) {
  usage()
  process.exit(2)
}

const inputPath = resolve(input)
if (!existsSync(inputPath)) {
  console.error(`Blueprint not found: ${inputPath}`)
  process.exit(2)
}

let blueprint
try {
  blueprint = JSON.parse(readFileSync(inputPath, 'utf8'))
} catch (error) {
  console.error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(2)
}

const errors = []
const warnings = []
const error = (path, message) => errors.push({ path, message })
const warn = (path, message) => warnings.push({ path, message })

function arrayAt(value, path) {
  if (!Array.isArray(value)) {
    error(path, 'must be an array')
    return []
  }
  return value
}

function objectAt(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    error(path, 'must be an object')
    return {}
  }
  return value
}

function validKey(value, path) {
  if (typeof value !== 'string' || !VALID_KEY.test(value)) {
    error(path, 'must use lowercase letters, digits, hyphens, or underscores and start with a letter')
    return false
  }
  return true
}

function keyedMap(items, path) {
  const map = new Map()
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      error(`${path}[${index}]`, 'must be an object')
      return
    }
    if (!validKey(item.key, `${path}[${index}].key`)) return
    if (map.has(item.key)) {
      error(`${path}[${index}].key`, `duplicates ${item.key}`)
      return
    }
    map.set(item.key, item)
  })
  return map
}

function stringSet(value, path, validValues) {
  const result = new Set()
  arrayAt(value, path).forEach((item, index) => {
    if (typeof item !== 'string') {
      error(`${path}[${index}]`, 'must be a string')
      return
    }
    if (validValues && !validValues.has(item)) {
      error(`${path}[${index}]`, `unsupported value: ${item}`)
    }
    if (result.has(item)) error(`${path}[${index}]`, `duplicates ${item}`)
    result.add(item)
  })
  return result
}

if (!blueprint || typeof blueprint !== 'object' || Array.isArray(blueprint)) {
  console.error('Blueprint root must be an object.')
  process.exit(2)
}

if (blueprint.schemaVersion !== '1.3') {
  error('schemaVersion', 'must equal 1.3')
}

const pipeline = objectAt(blueprint.pipeline, 'pipeline')
validKey(pipeline.key, 'pipeline.key')
validKey(pipeline.templateKey, 'pipeline.templateKey')
validKey(pipeline.startNodeKey, 'pipeline.startNodeKey')
if (typeof pipeline.title !== 'string' || pipeline.title.trim() === '') {
  error('pipeline.title', 'must be a non-empty string')
}
if (typeof pipeline.artifactNamespace !== 'string' || !VALID_NAMESPACE.test(pipeline.artifactNamespace)) {
  error('pipeline.artifactNamespace', 'must use lowercase letters, digits, or underscores and start with a letter')
}
if (!Number.isInteger(pipeline.templateVersion) || pipeline.templateVersion < 1) {
  error('pipeline.templateVersion', 'must be an integer greater than or equal to 1')
}

const caseModel = objectAt(blueprint.caseModel, 'caseModel')
for (const field of [
  'keyField',
  'titleField',
  'statusField',
  'revisionField',
  'templateKeyField',
  'templateVersionField'
]) {
  validKey(caseModel[field], `caseModel.${field}`)
}
const scopeFields = stringSet(caseModel.scopeFields, 'caseModel.scopeFields')
if (scopeFields.size === 0) error('caseModel.scopeFields', 'must contain at least one tenant or organization scope field')
scopeFields.forEach((key) => validKey(key, 'caseModel.scopeFields'))
const lifecycleStatuses = stringSet(caseModel.lifecycleStatuses, 'caseModel.lifecycleStatuses')
if (lifecycleStatuses.size < 2) error('caseModel.lifecycleStatuses', 'must contain at least two Case lifecycle statuses')
lifecycleStatuses.forEach((key) => validKey(key, 'caseModel.lifecycleStatuses'))

const delivery = objectAt(blueprint.delivery, 'delivery')
const surfaces = stringSet(delivery.surfaces, 'delivery.surfaces', SURFACES)
if (surfaces.size === 0) error('delivery.surfaces', 'must contain at least one delivery surface')
if (!TOPOLOGIES.has(delivery.assistantTopology)) {
  error('delivery.assistantTopology', `unsupported value: ${delivery.assistantTopology}`)
}
let assistantParticipants = {}
if (
  surfaces.has('assistant') ||
  ['orchestrated_roles', 'both'].includes(delivery.assistantTopology) ||
  delivery.assistantParticipants !== undefined
) {
  assistantParticipants = objectAt(delivery.assistantParticipants, 'delivery.assistantParticipants')
  if (assistantParticipants.roleMode !== 'independent_assistants') {
    error('delivery.assistantParticipants.roleMode', 'lane-owning AI roles must use independent Assistants, not sub-Agents')
  }
  if (delivery.assistantTopology === 'standalone_roles') {
    if (assistantParticipants.orchestratorDelegation !== 'none') {
      error('delivery.assistantParticipants.orchestratorDelegation', 'standalone role Assistants must not declare an Orchestrator')
    }
    if (assistantParticipants.externalXpertConnections !== 'none') {
      error('delivery.assistantParticipants.externalXpertConnections', 'standalone role Assistants must not require External Xpert connections')
    }
  }
  if (['orchestrated_roles', 'both'].includes(delivery.assistantTopology)) {
    if (assistantParticipants.orchestratorDelegation !== 'external_xperts') {
      error('delivery.assistantParticipants.orchestratorDelegation', 'Orchestrator must delegate role work through External Xperts')
    }
    if (assistantParticipants.externalXpertConnections !== 'direct_required') {
      error('delivery.assistantParticipants.externalXpertConnections', 'every role Assistant must use one direct required External Xpert connection')
    }
  }
}
const pipelineWorkbench = objectAt(delivery.pipelineWorkbench, 'delivery.pipelineWorkbench')
if (!WORKBENCH_MODES.has(pipelineWorkbench.mode)) {
  error('delivery.pipelineWorkbench.mode', `unsupported value: ${pipelineWorkbench.mode}`)
}
if (pipelineWorkbench.mode === 'required') {
  if (!surfaces.has('workbench')) {
    error('delivery.surfaces', 'required Cases pipeline Workbench must include the workbench surface')
  }
  validKey(pipelineWorkbench.overviewViewKey, 'delivery.pipelineWorkbench.overviewViewKey')
  validKey(pipelineWorkbench.dashboardViewKey, 'delivery.pipelineWorkbench.dashboardViewKey')
}
if (pipelineWorkbench.mode === 'waived') {
  if (typeof pipelineWorkbench.waiverReason !== 'string' || pipelineWorkbench.waiverReason.trim() === '') {
    error('delivery.pipelineWorkbench.waiverReason', 'an explicit Workbench waiver requires a non-empty reason')
  }
  if (pipelineWorkbench.overviewViewKey) {
    warn('delivery.pipelineWorkbench.overviewViewKey', 'waived Workbench should not declare a default pipeline overview')
  }
  if (pipelineWorkbench.dashboardViewKey) {
    warn('delivery.pipelineWorkbench.dashboardViewKey', 'waived Workbench should not declare a management dashboard')
  }
}

const projectionContract = objectAt(blueprint.projectionContract, 'projectionContract')
for (const field of PROJECTION_OPERATIONS) {
  validKey(projectionContract[field], `projectionContract.${field}`)
}
if (pipelineWorkbench.mode === 'required' || projectionContract.dashboardProject !== undefined) {
  validKey(projectionContract.dashboardProject, 'projectionContract.dashboardProject')
}
if (!REFRESH_STRATEGIES.has(projectionContract.refreshStrategy)) {
  error('projectionContract.refreshStrategy', `unsupported value: ${projectionContract.refreshStrategy}`)
}

const executionRecords = objectAt(blueprint.executionRecords, 'executionRecords')
if (!['case_node_lane_bound', 'audit_only'].includes(executionRecords.mode)) {
  error('executionRecords.mode', `unsupported value: ${executionRecords.mode}`)
}
if (executionRecords.retention !== 'immutable_attempts') {
  error('executionRecords.retention', 'must preserve immutable_attempts, including failed and superseded runs')
}
if (executionRecords.navigationClientCommand !== 'workbench.navigation.open') {
  error('executionRecords.navigationClientCommand', 'must use the public workbench.navigation.open client command')
}
if (executionRecords.navigationTarget !== 'assistant.conversation') {
  error('executionRecords.navigationTarget', 'must target assistant.conversation for exact ChatKit execution navigation')
}
if (pipelineWorkbench.mode === 'required' || executionRecords.visibleLimit !== undefined) {
  if (!Number.isInteger(executionRecords.visibleLimit) || executionRecords.visibleLimit < 1 || executionRecords.visibleLimit > 10) {
    error('executionRecords.visibleLimit', 'must be an integer from 1 through 10 for Assistant-card and task-card execution markers')
  }
}
if (pipelineWorkbench.mode === 'required' || executionRecords.presentationTargets !== undefined) {
  const presentationTargets = stringSet(
    executionRecords.presentationTargets,
    'executionRecords.presentationTargets',
    new Set(['assistant_card', 'task_card'])
  )
  for (const target of ['assistant_card', 'task_card']) {
    if (!presentationTargets.has(target)) {
      error('executionRecords.presentationTargets', `must include ${target}`)
    }
  }
}
if (pipelineWorkbench.mode === 'required' && executionRecords.mode !== 'case_node_lane_bound') {
  error('executionRecords.mode', 'required Cases pipeline Workbench must attach Agent execution records to Case/node/lane identities')
}

let viewExperience = {}
if (pipelineWorkbench.mode === 'required' || blueprint.viewExperience !== undefined) {
  viewExperience = objectAt(blueprint.viewExperience, 'viewExperience')
  if (!['@xpert-ai/plugin-shadcn-ui', 'shadcn-cli-local'].includes(viewExperience.componentLibrary)) {
    error('viewExperience.componentLibrary', 'must use a current-repository shadcn source: @xpert-ai/plugin-shadcn-ui or shadcn-cli-local')
  }
  const dashboardExperience = objectAt(viewExperience.dashboard, 'viewExperience.dashboard')
  if (dashboardExperience.chartLibrary !== 'echarts') {
    error('viewExperience.dashboard.chartLibrary', 'must default to echarts')
  }
  if (dashboardExperience.layout !== 'management_monitoring') {
    error('viewExperience.dashboard.layout', 'must use the management_monitoring dashboard contract')
  }
  const swimlaneExperience = objectAt(viewExperience.swimlane, 'viewExperience.swimlane')
  if (swimlaneExperience.assistantAvatarSource !== 'platform_assistant') {
    error('viewExperience.swimlane.assistantAvatarSource', 'must resolve actual platform Assistant Avatars')
  }
  if (swimlaneExperience.assistantExecutionMarkerPlacement !== 'assistant_card_bottom_right') {
    error('viewExperience.swimlane.assistantExecutionMarkerPlacement', 'must place lane-summary execution markers at the Assistant card bottom-right')
  }
  if (swimlaneExperience.nodeExecutionMarkerPlacement !== 'task_card_bottom_right') {
    error('viewExperience.swimlane.nodeExecutionMarkerPlacement', 'must place node-filtered execution markers at the task card bottom-right')
  }
  if (swimlaneExperience.logicNodeShape !== 'diamond') {
    error('viewExperience.swimlane.logicNodeShape', 'routers and equivalent control-flow logic nodes must use a diamond')
  }
  if (swimlaneExperience.dragPan !== true) {
    error('viewExperience.swimlane.dragPan', 'must enable drag-to-pan on the swimlane canvas')
  }
  if (swimlaneExperience.laneSelection !== true) {
    error('viewExperience.swimlane.laneSelection', 'must allow the Assistant card to select the entire lane')
  }
}

const features = stringSet(blueprint.features, 'features')
features.forEach((feature, index) => validKey(feature, `features[${index}]`))
const roles = arrayAt(blueprint.roles, 'roles')
const lanes = arrayAt(blueprint.lanes, 'lanes')
const stages = arrayAt(blueprint.stages, 'stages')
const artifacts = arrayAt(blueprint.artifacts, 'artifacts')
const middleware = arrayAt(blueprint.middleware, 'middleware')
const views = arrayAt(blueprint.views, 'views')
const routeFacts = arrayAt(blueprint.routeFacts, 'routeFacts')
const nodes = arrayAt(blueprint.nodes, 'nodes')
const edges = arrayAt(blueprint.edges, 'edges')

const roleMap = keyedMap(roles, 'roles')
const laneMap = keyedMap(lanes, 'lanes')
const stageMap = keyedMap(stages, 'stages')
const artifactMap = keyedMap(artifacts, 'artifacts')
const middlewareMap = keyedMap(middleware, 'middleware')
const viewMap = keyedMap(views, 'views')
const routeFactMap = keyedMap(routeFacts, 'routeFacts')
const nodeMap = keyedMap(nodes, 'nodes')

const orchestrators = roles.filter((role) => role?.kind === 'orchestrator')
const businessRoles = roles.filter((role) => role?.kind === 'business')
if (['orchestrated_roles', 'both'].includes(delivery.assistantTopology)) {
  if (orchestrators.length !== 1) {
    error('roles', 'orchestrated topology requires exactly one orchestrator role')
  }
  if (businessRoles.length < 2) {
    error('roles', 'orchestrated topology requires at least two business roles')
  }
  if (!surfaces.has('assistant')) {
    error('delivery.surfaces', 'orchestrated topology requires the assistant surface')
  }
}
if (delivery.assistantTopology === 'standalone_roles' && orchestrators.length > 0) {
  warn('roles', 'standalone topology declares an orchestrator role that should not be required for execution')
}

roles.forEach((role, index) => {
  if (!role || typeof role !== 'object') return
  if (!ROLE_KINDS.has(role.kind)) error(`roles[${index}].kind`, `unsupported value: ${role.kind}`)
  if (typeof role.writeAuthority !== 'boolean') error(`roles[${index}].writeAuthority`, 'must be boolean')
  if (role.kind === 'orchestrator' && role.writeAuthority !== false) {
    error(`roles[${index}].writeAuthority`, 'orchestrator must not receive blanket business write authority')
  }
  if (surfaces.has('assistant') && ['business', 'orchestrator'].includes(role.kind)) {
    validKey(role.assistantTemplateKey, `roles[${index}].assistantTemplateKey`)
  }
  const bindings = stringSet(role.middlewareBindings, `roles[${index}].middlewareBindings`)
  bindings.forEach((key) => {
    if (!middlewareMap.has(key)) error(`roles[${index}].middlewareBindings`, `references unknown middleware ${key}`)
  })
  if (role.kind === 'internal_specialist') {
    if (!role.parentRoleKey || !roleMap.has(role.parentRoleKey)) {
      error(`roles[${index}].parentRoleKey`, 'internal specialist requires an existing parent role')
    } else if (roleMap.get(role.parentRoleKey)?.kind !== 'business') {
      error(`roles[${index}].parentRoleKey`, 'internal specialist parent must be a business role')
    }
  } else if (role.parentRoleKey) {
    error(`roles[${index}].parentRoleKey`, 'only internal specialists may declare parentRoleKey')
  }
})

const laneOrders = new Set()
lanes.forEach((lane, index) => {
  if (!lane || typeof lane !== 'object') return
  const role = roleMap.get(lane.accountableRoleKey)
  if (!role) {
    error(`lanes[${index}].accountableRoleKey`, `references unknown role ${lane.accountableRoleKey}`)
  } else if (!['business', 'human_only'].includes(role.kind)) {
    error(`lanes[${index}].accountableRoleKey`, 'lane must be accountable to a business or human-only role')
  }
  if (!Number.isInteger(lane.order) || lane.order < 0) {
    error(`lanes[${index}].order`, 'must be a non-negative integer')
  } else if (laneOrders.has(lane.order)) {
    error(`lanes[${index}].order`, `duplicates lane order ${lane.order}`)
  } else {
    laneOrders.add(lane.order)
  }
})

const stageOrders = new Set()
stages.forEach((stage, index) => {
  if (!stage || typeof stage !== 'object') return
  if (typeof stage.title !== 'string' || stage.title.trim() === '') {
    error(`stages[${index}].title`, 'must be a non-empty string')
  }
  if (!Number.isInteger(stage.order) || stage.order < 0) {
    error(`stages[${index}].order`, 'must be a non-negative integer')
  } else if (stageOrders.has(stage.order)) {
    error(`stages[${index}].order`, `duplicates stage order ${stage.order}`)
  } else {
    stageOrders.add(stage.order)
  }
})
if (stageMap.size < 2) error('stages', 'must contain at least two ordered stages')

artifacts.forEach((artifact, index) => {
  if (!artifact || typeof artifact !== 'object') return
  if (!roleMap.has(artifact.ownerRoleKey)) {
    error(`artifacts[${index}].ownerRoleKey`, `references unknown role ${artifact.ownerRoleKey}`)
  }
  if (typeof artifact.versioned !== 'boolean') error(`artifacts[${index}].versioned`, 'must be boolean')
})

const toolOwners = new Map()
middleware.forEach((item, index) => {
  if (!item || typeof item !== 'object') return
  if (!roleMap.has(item.ownerRoleKey)) {
    error(`middleware[${index}].ownerRoleKey`, `references unknown role ${item.ownerRoleKey}`)
  }
  const featureKeys = stringSet(item.featureKeys, `middleware[${index}].featureKeys`)
  if (featureKeys.size === 0) error(`middleware[${index}].featureKeys`, 'must contain at least one Feature')
  featureKeys.forEach((key) => {
    if (!features.has(key)) error(`middleware[${index}].featureKeys`, `references undeclared Feature ${key}`)
  })
  const tools = arrayAt(item.tools, `middleware[${index}].tools`)
  if (tools.length === 0) error(`middleware[${index}].tools`, 'must contain at least one tool')
  tools.forEach((tool, toolIndex) => {
    if (!tool || typeof tool !== 'object') {
      error(`middleware[${index}].tools[${toolIndex}]`, 'must be an object')
      return
    }
    if (!validKey(tool.name, `middleware[${index}].tools[${toolIndex}].name`)) return
    if (!['read', 'write', 'decision_support'].includes(tool.mode)) {
      error(`middleware[${index}].tools[${toolIndex}].mode`, `unsupported value: ${tool.mode}`)
    }
    if (toolOwners.has(tool.name)) {
      error(`middleware[${index}].tools[${toolIndex}].name`, `tool ${tool.name} already belongs to ${toolOwners.get(tool.name).middlewareKey}`)
    } else {
      toolOwners.set(tool.name, {
        middlewareKey: item.key,
        featureKeys,
        ownerRoleKey: item.ownerRoleKey,
        mode: tool.mode
      })
    }
  })
})

middleware.forEach((item, index) => {
  if (!item || typeof item !== 'object') return
  const owner = roleMap.get(item.ownerRoleKey)
  if (owner && !new Set(owner.middlewareBindings || []).has(item.key)) {
    error(`middleware[${index}]`, `owning role ${item.ownerRoleKey} does not bind middleware ${item.key}`)
  }
})

const declaredActions = new Set()
views.forEach((view, index) => {
  if (!view || typeof view !== 'object') return
  if (typeof view.title !== 'string' || view.title.trim() === '') {
    error(`views[${index}].title`, 'must be a non-empty string')
  }
  if (!VIEW_KINDS.has(view.kind)) {
    error(`views[${index}].kind`, `unsupported value: ${view.kind}`)
  }
  const featureKeys = stringSet(view.featureKeys, `views[${index}].featureKeys`)
  if (featureKeys.size === 0) error(`views[${index}].featureKeys`, 'must contain at least one Feature')
  featureKeys.forEach((key) => {
    if (!features.has(key)) error(`views[${index}].featureKeys`, `references undeclared Feature ${key}`)
  })
  const actionKeys = stringSet(view.actionKeys, `views[${index}].actionKeys`)
  actionKeys.forEach((key) => {
    validKey(key, `views[${index}].actionKeys`)
    declaredActions.add(key)
  })
  const clientCommandKeys = stringSet(view.clientCommandKeys, `views[${index}].clientCommandKeys`)
  clientCommandKeys.forEach((key) => {
    if (!VALID_CLIENT_COMMAND.test(key)) {
      error(`views[${index}].clientCommandKeys`, `invalid client command key: ${key}`)
    }
  })
})
if (surfaces.has('workbench') && viewMap.size === 0) {
  error('views', 'workbench delivery requires at least one View')
}
if (!surfaces.has('workbench') && viewMap.size > 0) {
  error('delivery.surfaces', 'declare the workbench surface when Views are present')
}
const pipelineOverviewViews = views.filter((view) => view?.kind === 'pipeline_overview')
const operationsDashboardViews = views.filter((view) => view?.kind === 'operations_dashboard')
if (pipelineWorkbench.mode === 'required') {
  if (pipelineOverviewViews.length !== 1) {
    error('views', 'required Cases pipeline Workbench needs exactly one pipeline_overview View')
  }
  const overview = viewMap.get(pipelineWorkbench.overviewViewKey)
  if (!overview) {
    error('delivery.pipelineWorkbench.overviewViewKey', `references unknown View ${pipelineWorkbench.overviewViewKey}`)
  } else if (overview.kind !== 'pipeline_overview') {
    error('delivery.pipelineWorkbench.overviewViewKey', 'must reference the pipeline_overview View')
  } else if (!new Set(overview.clientCommandKeys || []).has(executionRecords.navigationClientCommand)) {
    error(
      'views',
      `pipeline_overview must allowlist ${executionRecords.navigationClientCommand} to open exact Agent executions`
    )
  }
  if (operationsDashboardViews.length !== 1) {
    error('views', 'required Cases pipeline Workbench needs exactly one operations_dashboard View')
  }
  const dashboard = viewMap.get(pipelineWorkbench.dashboardViewKey)
  if (!dashboard) {
    error('delivery.pipelineWorkbench.dashboardViewKey', `references unknown View ${pipelineWorkbench.dashboardViewKey}`)
  } else if (dashboard.kind !== 'operations_dashboard') {
    error('delivery.pipelineWorkbench.dashboardViewKey', 'must reference the operations_dashboard View')
  } else if (!new Set(dashboard.clientCommandKeys || []).has('workbench.navigation.open')) {
    error('views', 'operations_dashboard must allowlist workbench.navigation.open for Case-to-swimlane navigation')
  }
}
if (pipelineWorkbench.mode === 'waived' && (pipelineOverviewViews.length > 0 || operationsDashboardViews.length > 0)) {
  warn('views', 'Workbench Views are present even though the Cases pipeline Workbench is waived')
}

routeFacts.forEach((fact, index) => {
  if (!fact || typeof fact !== 'object') return
  if (!artifactMap.has(fact.sourceArtifactKey)) {
    error(`routeFacts[${index}].sourceArtifactKey`, `references unknown artifact ${fact.sourceArtifactKey}`)
  }
  const values = stringSet(fact.values, `routeFacts[${index}].values`)
  if (values.size < 2) error(`routeFacts[${index}].values`, 'must contain at least two distinct values')
  values.forEach((value) => validKey(value, `routeFacts[${index}].values`))
})

const taskNodes = []
const routerNodes = []
const terminalNodes = []
let assistantTaskCount = 0

function accessibleMiddlewareForRole(roleKey) {
  const keys = new Set(roleMap.get(roleKey)?.middlewareBindings || [])
  roles.forEach((role) => {
    if (role?.kind === 'internal_specialist' && role.parentRoleKey === roleKey) {
      for (const key of role.middlewareBindings || []) keys.add(key)
    }
  })
  return keys
}

nodes.forEach((node, index) => {
  if (!node || typeof node !== 'object') return
  if (typeof node.title !== 'string' || node.title.trim() === '') {
    error(`nodes[${index}].title`, 'must be a non-empty string for Workbench presentation and audit evidence')
  }
  if (!stageMap.has(node.stageKey)) {
    error(`nodes[${index}].stageKey`, `references unknown stage ${node.stageKey}`)
  }
  if (node.kind === 'terminal') {
    terminalNodes.push(node)
    return
  }
  if (node.kind === 'router') {
    routerNodes.push(node)
    if (!routeFactMap.has(node.routeFactKey)) {
      error(`nodes[${index}].routeFactKey`, `references unknown route fact ${node.routeFactKey}`)
    }
    return
  }
  if (node.kind !== 'task') {
    error(`nodes[${index}].kind`, `unsupported value: ${node.kind}`)
    return
  }

  taskNodes.push(node)
  const lane = laneMap.get(node.laneKey)
  if (!lane) {
    error(`nodes[${index}].laneKey`, `references unknown lane ${node.laneKey}`)
  }
  const role = roleMap.get(node.accountableRoleKey)
  if (!role) {
    error(`nodes[${index}].accountableRoleKey`, `references unknown role ${node.accountableRoleKey}`)
  }
  if (lane && lane.accountableRoleKey !== node.accountableRoleKey) {
    error(`nodes[${index}]`, `lane ${node.laneKey} is accountable to ${lane.accountableRoleKey}, not ${node.accountableRoleKey}`)
  }
  if (pipelineWorkbench.mode === 'required' && node.openMode === undefined) {
    error(`nodes[${index}].openMode`, 'is required by the default Workbench')
  } else if (node.openMode !== undefined && !NODE_OPEN_MODES.has(node.openMode)) {
    error(`nodes[${index}].openMode`, `unsupported value: ${node.openMode}`)
  }
  if (node.workspaceKey) {
    const workspace = viewMap.get(node.workspaceKey)
    if (!workspace) {
      error(`nodes[${index}].workspaceKey`, `references unknown View ${node.workspaceKey}`)
    } else if (!['node_workspace', 'case_detail'].includes(workspace.kind)) {
      error(`nodes[${index}].workspaceKey`, 'must reference a node_workspace or case_detail View')
    }
  }
  if (node.componentKey) {
    validKey(node.componentKey, `nodes[${index}].componentKey`)
  }
  if (pipelineWorkbench.mode === 'required') {
    if (node.openMode === 'view' && !node.workspaceKey) {
      error(`nodes[${index}].workspaceKey`, 'openMode view requires an authorized node_workspace or case_detail View')
    }
    if (node.openMode === 'component' && !node.componentKey) {
      error(`nodes[${index}].componentKey`, 'openMode component requires an allowlisted component key')
    }
    if (node.openMode === 'dialog' && (node.workspaceKey || node.componentKey)) {
      warn(`nodes[${index}]`, 'openMode dialog should use bounded projected details instead of declaring a workspace/component target')
    }
  }
  if (!node.completion || typeof node.completion !== 'object') {
    error(`nodes[${index}].completion`, 'must be an object')
  } else {
    if (!artifactMap.has(node.completion.artifactKey)) {
      error(`nodes[${index}].completion.artifactKey`, `references unknown artifact ${node.completion.artifactKey}`)
    }
    if (typeof node.completion.predicate !== 'string' || node.completion.predicate.trim() === '') {
      error(`nodes[${index}].completion.predicate`, 'must be a non-empty business predicate')
    }
  }

  const execution = node.execution && typeof node.execution === 'object' ? node.execution : {}
  if (!EXECUTION_MODES.has(execution.mode)) {
    error(`nodes[${index}].execution.mode`, `unsupported value: ${execution.mode}`)
  }
  const toolNames = stringSet(execution.toolNames, `nodes[${index}].execution.toolNames`)
  if (execution.mode === 'assistant_task') {
    assistantTaskCount += 1
    if (toolNames.size === 0) warn(`nodes[${index}].execution.toolNames`, 'Assistant task has no declared node-level tools')
  } else if (toolNames.size > 0) {
    error(`nodes[${index}].execution.toolNames`, `${execution.mode} execution must not receive Agent tools`)
  }

  const requiredFeatures = stringSet(node.requiredFeatureKeys, `nodes[${index}].requiredFeatureKeys`)
  requiredFeatures.forEach((key) => {
    if (!features.has(key)) error(`nodes[${index}].requiredFeatureKeys`, `references undeclared Feature ${key}`)
  })
  const accessibleMiddleware = accessibleMiddlewareForRole(node.accountableRoleKey)
  toolNames.forEach((name) => {
    const owner = toolOwners.get(name)
    if (!owner) {
      error(`nodes[${index}].execution.toolNames`, `references undeclared tool ${name}`)
      return
    }
    if (!accessibleMiddleware.has(owner.middlewareKey)) {
      error(`nodes[${index}].execution.toolNames`, `role ${node.accountableRoleKey} cannot reach owning middleware ${owner.middlewareKey} for ${name}`)
    }
    owner.featureKeys.forEach((featureKey) => {
      if (!requiredFeatures.has(featureKey)) {
        error(`nodes[${index}].requiredFeatureKeys`, `must include ${featureKey} required by tool ${name}`)
      }
    })
  })

  const actionKeys = stringSet(node.allowedActionKeys, `nodes[${index}].allowedActionKeys`)
  actionKeys.forEach((key) => {
    if (!declaredActions.has(key)) error(`nodes[${index}].allowedActionKeys`, `references undeclared View action ${key}`)
  })
  if (actionKeys.size > 0 && !surfaces.has('workbench')) {
    error(`nodes[${index}].allowedActionKeys`, 'View actions require the workbench delivery surface')
  }

  if (!RISKS.has(node.risk)) error(`nodes[${index}].risk`, `unsupported value: ${node.risk}`)
  if (!HUMAN_GATES.has(node.humanGate)) error(`nodes[${index}].humanGate`, `unsupported value: ${node.humanGate}`)
  if (node.risk === 'irreversible' && node.humanGate === 'none') {
    error(`nodes[${index}].humanGate`, 'irreversible task requires approval or trusted external confirmation')
  } else if (node.risk === 'high' && node.humanGate === 'none') {
    warn(`nodes[${index}].humanGate`, 'high-risk task has no explicit human review or external confirmation')
  }
})

if (assistantTaskCount > 0 && !surfaces.has('assistant')) {
  error('delivery.surfaces', 'assistant_task nodes require the assistant delivery surface')
}
if (terminalNodes.length === 0) error('nodes', 'must contain at least one terminal node')
if (!nodeMap.has(pipeline.startNodeKey)) {
  error('pipeline.startNodeKey', `references unknown node ${pipeline.startNodeKey}`)
}

const outgoing = new Map([...nodeMap.keys()].map((key) => [key, []]))
const incoming = new Map([...nodeMap.keys()].map((key) => [key, []]))
const edgeKeys = new Set()

edges.forEach((edge, index) => {
  if (!edge || typeof edge !== 'object') {
    error(`edges[${index}]`, 'must be an object')
    return
  }
  const from = nodeMap.get(edge.from)
  const to = nodeMap.get(edge.to)
  if (!from) error(`edges[${index}].from`, `references unknown node ${edge.from}`)
  if (!to) error(`edges[${index}].to`, `references unknown node ${edge.to}`)
  const signature = `${edge.from}->${edge.to}:${edge.condition?.factKey || ''}:${edge.condition?.value || ''}`
  if (edgeKeys.has(signature)) error(`edges[${index}]`, 'duplicates another edge')
  edgeKeys.add(signature)
  if (from && to) {
    outgoing.get(edge.from).push(edge)
    incoming.get(edge.to).push(edge)
  }

  if (from?.kind === 'router') {
    const fact = routeFactMap.get(from.routeFactKey)
    if (!edge.condition || typeof edge.condition !== 'object') {
      error(`edges[${index}].condition`, 'router exit requires a condition')
    } else if (fact) {
      if (edge.condition.factKey !== from.routeFactKey) {
        error(`edges[${index}].condition.factKey`, `must equal router fact ${from.routeFactKey}`)
      }
      if (!new Set(fact.values || []).has(edge.condition.value)) {
        error(`edges[${index}].condition.value`, `is not declared by route fact ${from.routeFactKey}`)
      }
    }
  } else if (edge.condition) {
    error(`edges[${index}].condition`, 'only router exits may declare a condition')
  }
})

nodes.forEach((node, index) => {
  if (!node || typeof node !== 'object' || !node.key) return
  const next = outgoing.get(node.key) || []
  const previous = incoming.get(node.key) || []
  if (node.kind === 'terminal' && next.length > 0) {
    error(`nodes[${index}]`, 'terminal node must not have outgoing edges')
  }
  if (node.kind !== 'terminal' && next.length === 0) {
    error(`nodes[${index}]`, 'non-terminal node must have at least one outgoing edge')
  }
  if (node.key !== pipeline.startNodeKey && previous.length === 0) {
    error(`nodes[${index}]`, 'non-start node must have at least one incoming edge')
  }
  if (node.key === pipeline.startNodeKey && previous.length > 0) {
    error(`nodes[${index}]`, 'start node must not have incoming edges in a DAG template')
  }
})

routerNodes.forEach((router) => {
  const next = outgoing.get(router.key) || []
  if (next.length < 2) error(`nodes.${router.key}`, 'router requires at least two exits')
  const values = next.map((edge) => edge.condition?.value).filter(Boolean)
  if (new Set(values).size !== values.length) error(`nodes.${router.key}`, 'router exit values must be unique')
  const fact = routeFactMap.get(router.routeFactKey)
  if (fact) {
    const missing = (fact.values || []).filter((value) => !values.includes(value))
    if (missing.length > 0) error(`nodes.${router.key}`, `router does not cover fact values: ${missing.join(', ')}`)
  }
})

const reachable = new Set()
function visitReachable(key) {
  if (!nodeMap.has(key) || reachable.has(key)) return
  reachable.add(key)
  for (const edge of outgoing.get(key) || []) visitReachable(edge.to)
}
visitReachable(pipeline.startNodeKey)
for (const key of nodeMap.keys()) {
  if (!reachable.has(key)) error(`nodes.${key}`, 'is unreachable from the declared start node')
}

const visiting = new Set()
const visited = new Set()
function detectCycle(key, path) {
  if (visiting.has(key)) {
    error('edges', `cycle detected: ${[...path, key].join(' -> ')}`)
    return
  }
  if (visited.has(key)) return
  visiting.add(key)
  for (const edge of outgoing.get(key) || []) detectCycle(edge.to, [...path, key])
  visiting.delete(key)
  visited.add(key)
}
for (const key of nodeMap.keys()) detectCycle(key, [])

const usedArtifacts = new Set([
  ...taskNodes.map((node) => node.completion?.artifactKey).filter(Boolean),
  ...routeFacts.map((fact) => fact?.sourceArtifactKey).filter(Boolean)
])
for (const key of artifactMap.keys()) {
  if (!usedArtifacts.has(key)) warn(`artifacts.${key}`, 'is not used by a completion predicate or route fact')
}
const usedMiddleware = new Set(roles.flatMap((role) => role?.middlewareBindings || []))
for (const key of middlewareMap.keys()) {
  if (!usedMiddleware.has(key)) warn(`middleware.${key}`, 'is not bound to any role')
}

const report = {
  file: inputPath,
  valid: errors.length === 0,
  summary: {
    roles: roleMap.size,
    lanes: laneMap.size,
    stages: stageMap.size,
    artifacts: artifactMap.size,
    middleware: middlewareMap.size,
    tools: toolOwners.size,
    views: viewMap.size,
    routeFacts: routeFactMap.size,
    nodes: nodeMap.size,
    edges: edges.length
  },
  errors,
  warnings
}

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`${report.valid ? 'VALID' : 'INVALID'}: ${inputPath}`)
  console.log(`Summary: ${Object.entries(report.summary).map(([key, value]) => `${key}=${value}`).join(', ')}`)
  for (const item of errors) console.log(`[error] ${item.path}: ${item.message}`)
  for (const item of warnings) console.log(`[warning] ${item.path}: ${item.message}`)
}

process.exit(report.valid ? 0 : 1)
