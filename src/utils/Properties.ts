export enum ResponseType {
    Defer = 0,
    EphemeralDefer = 1,
    Default = 2
}

export default class Properties {
    public static colors = {
        default: 0x008EFF
    }

    public static roles = {
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
}