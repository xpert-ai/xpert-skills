# Features And Studio UI Mapping

`team.features` is the serialized source of Studio's Assistant-level 功能 configuration. It is separate from plugin contribution metadata.

| Studio feature | DSL path | Main fields |
|---|---|---|
| 对话开场白 | `team.features.opener` | `enabled`, `message`, `questions` |
| 问题建议 | `team.features.suggestion` | `enabled`, `prompt` |
| 文字转语音 | `team.features.textToSpeech` | `enabled`, optional `copilotModel` |
| 语音转文字 | `team.features.speechToText` | `enabled`, optional `copilotModel` |
| 文件上传 | `team.features.attachment` | `enabled`, `type`, `maxNum`, `fileTypes` |
| 记忆回复 | `team.features.memoryReply` | `enabled`, optional `scoreThreshold` |
| 沙箱 | `team.features.sandbox` | `enabled`, optional `provider` |
| 总结标题 | `team.features.title` | `enabled`, optional `instruction` |

## Opener Question Semantics

Two fields are often confused:

| Layer | Property | Consumer |
|---|---|---|
| Plugin template contribution | `startPrompts` | Template/catalog and application-owned common-question metadata. |
| Studio feature | `team.features.opener.questions` | “功能 → 对话开场白 → 开场白问题”. |

The plugin installer is not guaranteed to convert contribution `startPrompts` into the DSL feature. Generate both applicable fields from one array.

Recommended contract:

```yaml
team:
  features:
    opener:
      enabled: true
      message: ''
      questions:
        - 最近 30 天运营情况如何？
```

Rules:

- Keep at most 10 non-empty, unique questions.
- Keep contribution `startPrompts` and enabled opener `questions` identical unless the product explicitly documents a different catalog experience.
- Set `message` deliberately; an empty string is valid when only questions are needed.
- Increment `team.version` when feature behavior changes.
- Test the parsed generated DSL against the contribution object.

## Attachment Boundaries

Assistant-level `team.features.attachment` controls whether the chat surface accepts uploads. Agent-level `entity.options.attachment` controls how a particular Agent receives/understands attached files. Configure both layers when a visible upload must be consumable by a specific Agent; one does not grant the other automatically.

## Model-Bearing Features

Text-to-speech and speech-to-text may reference dedicated models. Treat referenced model or credential IDs as instance-owned unless the reusable template is explicitly responsible for a portable provider configuration.
