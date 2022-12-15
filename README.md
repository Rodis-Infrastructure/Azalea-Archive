# moderation-bot
The Roblox Discord's Moderation Bot

<br>

### Configuration

Color configuration, the colors used by default for certain embeds unless overriden.
```yaml
colors:
    embedDefault: 0x000000
```
<br>

Forced ephemeral responses, If enabled, all interaction responses used outside of excluded categories/channels will have a deferred ephemeral response, even if an `InteractionResponseType` is specified.
```yaml
forceEphemeralResponse:
    isEnabled: true
    excludedCategories: [] # A list of category IDs not affected by this rule
    excludedChannels: [] # A list of channel IDs not affected by this rule
```
<br>

Role configuration, the names of the roles do not affect the code, they are there to improve readability and to accommodate potential usage by anyone who chooses to host this bot. Each role would have an ID (`roleId`) and permitted interactions as specified below. **Each permitted interaction's custom ID must be added as an array item**.
```yaml
roles:
    roleName:
        roleId: "ROLE_ID"
        messageCommands: [] # A list of message context menu command names
        slashCommands: [] # A list of slash command names
        userCommands: [] # A list of user context menu command names
        selectMenus: [] # A list of select menu custom IDs
        buttons: [] # A list of button custom IDs
        modals: [] # A list of modal custom IDs
```
<br>

Logging configuration, all of the logging events are managed in this rule. Below is a list of available logging events:

* `interactionUsage` Triggered when an interaction is used, whether it is a command, button, modal, or select menu.
```yaml
logging:
    excludedCategories: [] # A list of category IDs not affected by ANY logging events
    excludedChannels: [] # A list of channel IDs not affected by ANY logging events

    loggingEvent:
        isEnabled: true
        channelId: "CHANNEL_ID" # The channel in which the logs are send
        excludedCategories: [] # A list of category IDs not affected by this logging event
        excludedChannels: [] # A list of channel IDs not affected by this logging event
```