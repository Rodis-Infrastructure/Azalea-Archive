## Azalea Moderation Bot

This file serves as documentation for the Roblox Discord's moderation bot.

## Configuration

For a full example of the configuration, you can view the [`example.toml`](config/guilds/example.toml) file in the
repository

### Message Deletion on Ban

The `deleteMessageSecondsOnBan` field determines the period of time (in second) over which the banned user's messages
will be deleted. If set to `0`, the bot will not delete any messages.

```toml
deleteMessageSecondsOnBan = 0
```

### Channel Configuration

The `channels` field allows you to configure channels that would be used for specific purposes. The fields listed below:

* `staffCommands` - The channel where responses to moderation commands would be sent if they were used elsewhere.

```toml
[channels]
staffCommands = "channel-id"
```

### Custom Emojis

The `emojis` section enables you to customize the emojis used for the bot's responses. The fields listed below are the
emojis that can currently be configured for different types of responses.

```toml
[emojis]
success = "👌"
error = "<:emoji-name:emoji-id>"
quickMute30 = "<:emoji-name:emoji-id>"
quickMute60 = "<:emoji-name:emoji-id>"
purgeMessages = "<:emoji-name:emoji-id>"
```

### Ephemeral Responses

The `ephemeralResponses` section controls the behavior of the bot's interaction responses. If enabled, all interaction
responses used outside excluded categories/channels will have an ephemeral response, even if
an `InteractionResponseType` is specified.

```toml
[ephemeralResponses]
enabled = true
excludedCategories = []
excludedChannels = []
```

### Role and Group Configuration

The `roles` and `groups` sections allow you to configure which roles have access to specific message components and
modals.

#### Role Configuration

```toml
[[roles]]
id = "role-id"
staff = false
selections = []
buttons = []
modals = []
reactions = []
```

#### Role Group Configuration

```toml
[[groups]]
staff = false
roleIds = []
selectMenus = []
buttons = []
modals = []
reactions = []
```

### Logging Configuration

The `logging` section controls all the logging events. Below is a list of supported logging events (excluded
category/channel configuration does not apply to moderation infraction logging):

* `interactionUsage` - Triggered when an interaction is used, whether it is a command, button, modal, or select menu.
* `infractions` - Triggered when a user is given an infraction.
* `messages` - Triggered when a message is updated, deleted, or deleted in bulk.

```toml
[logging]
enabled = true
excludedCategories = []
excludedChannels = []

[logging.loggingEvent]
enabled = true
channelId = "channel-id"
excludedCategories = []
excludedChannels = []
```
