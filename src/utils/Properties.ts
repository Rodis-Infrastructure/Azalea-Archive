export default class Properties {
    public static colors = {
        default: 0x2e3136
    }

    public static roles = {
        trialModerator: "",
        trialStageOne: "1048341889067270256",
        trialStageTwo: "1048341947695247420",
        moderator: "998008300698341416",
        seniorModerator: "998008318364758147",
        manager: "998008333103534130"
    }

    public static channels = {
        moderators: "",
        trialModerators: "",
        commandUseLogs: "1049379240623226890",
        internalAffairs: "1049379300501114942",
        infrastructure: "",
        management: "",
        seniorModerators: ""
    }

    public static categories = {
        publicSector: "",
        internalChannels: "",
        internalLogs: "",
        internalMisc: ""
    }

    public static internalCategories = [
        this.categories.internalChannels,
        this.categories.publicSector,
        this.categories.internalLogs,
        this.categories.internalMisc
    ]

    public static preventLoggingEventsChannels = [
        this.channels.internalAffairs,
        this.channels.infrastructure,
        this.channels.management,
        this.channels.seniorModerators
    ]

    public static preventLoggingEventsCategories = [
        this.categories.internalLogs
    ]
}