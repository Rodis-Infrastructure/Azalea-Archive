export enum ResponseType {
    Defer = 0,
    EphemeralDefer = 1,
    Default = 2
}

export default class Properties {
    public static colors = {
        default: 0x2e3136
    }

    public static roles = {
        trialModerator: "",
        trialStageOne: "",
        trialStageTwo: "",
        moderator: "",
        seniorModerator: "",
        manager: ""
    }

    public static channels = {
        commandUseLogs: "",
        internalAffairs: "",
        infrastructure: "",
        management: "",
        seniorModerators: ""
    }

    public static categories = {
        internalLogs: ""
    }

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