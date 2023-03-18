## moderation-bot
This file serves as documentation for the moderation-bot, the Roblox Discord's moderation bot. Below are the available configuration options.

## Configuration
For a full example of the configuration, you can view the [`example.toml`](config/guilds/example.toml) file in the repository

### Ephemeral Responses
The `ephemeralResponses` section controls the behavior of the bot's interaction responses. If enabled, all interaction responses used outside excluded categories/channels will have an ephemeral response, even if an `InteractionResponseType` is specified.

```toml
[ephemeralResponses]
enabled = true
excludedCategories = []
excludedChannels = []
```

### Role and Group Configuration
The `roles` and `groups` sections allow you to configure which roles have access to specific message components and modals.

#### Role Configuration

```toml
[[roles]]
id = "role-id"
staff = false
# Interactions that can be used by users with this role (custom IDs)
selections = []
buttons = []
modals = []
```

#### Role Group Configuration

```toml
[[groups]]
staff = false
roles = []
selections = []
buttons = []
modals = []
```

### Logging Configuration
The `logging` section controls all the logging events. Below is a list of supported logging events:

* `interactionUsage` - Triggered when an interaction is used, whether it is a command, button, modal, or select menu.

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
