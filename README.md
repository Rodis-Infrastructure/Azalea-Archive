# moderation-bot
The Roblox Discord's Moderation Bot

<br>

### Configuration

Ephemeral responses, if enabled, all interaction responses used outside excluded categories/channels will have a deferred ephemeral response, even if an `InteractionResponseType` is specified.
```toml
[ephemeralResponses]
enabled = true
excludedCategories = [] # A list of category IDs not affected by this rule
excludedChannels = [] # A list of channel IDs not affected by this rule
```
<br>

Permission configuration, interaction permissions may either be set for a role or a group of roles. As application commands are configurable natively, this configuration is only used for message components and modals.

**Role configuration**:
```toml
[permissions.roles.roleId]
selections = [] # A list of select menu custom IDs
buttons = [] # A list of button custom IDs
modals = [] # A list of modal custom IDs
```

**Role group configuration**:
```toml
[permissions.groups.groupName]
roles = [] # A list of role IDs
selections = [] # A list of select menu custom IDs
buttons = [] # A list of button custom IDs
modals = [] # A list of modal custom IDs
```
<br>

Logging configuration, all the logging events are managed in this rule. Below is a list of supported logging events:

* `interactionUsage` Triggered when an interaction is used, whether it is a command, button, modal, or select menu.
```toml
[logging]
enabled = true # Disables all logging events if set to false
excludedCategories = [] # A list of category IDs not affected by ANY logging events
excludedChannels = [] # A list of channel IDs not affected by ANY logging events

[logging.loggingEvent]
enabled = true
channelId = "channel-id" # The channel in which the logs are send
excludedCategories = [] # A list of category IDs not affected by this logging event
excludedChannels = [] # A list of channel IDs not affected by this logging event
```