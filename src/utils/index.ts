export function capitalize(str: string): string {
    return str[0].toUpperCase() + str.slice(1);
}

export function msToString(timestamp: number): string {
    const units = [
        { unit: "day", value: 24 * 60 * 60 * 1000 },
        { unit: "hour", value: 60 * 60 * 1000 },
        { unit: "minute", value: 60 * 1000 }
    ];

    return units
        .map(({ unit, value }) => {
            const count = Math.floor(timestamp / value);
            timestamp %= value;
            return count && `${count} ${pluralize(unit, count)}`;
        })
        .filter(Boolean)
        .join(" ") || "< 1 minute";
}

export function elipsify(str: string, length: number) {
    const maxLength = length - 25;
    const newStr = str.slice(0, maxLength);
    return str.length > length
        ? `${newStr}...(${str.length - newStr.length} more characters)`
        : str;
}

/** Sanitizes a string for use in a SQL query */
export function sanitizeString(str: string | undefined | null): string | null {
    return str ? `'${str.replaceAll("'", "''")}'` : null;
}

export function formatReason(reason: string | null | undefined): string {
    return reason ? ` (\`${reason.replaceAll("`", "")}\`)` : "";
}

export function formatMediaURL(url: string, embed = false): string {
    const [formattedURL] = url.split("?");
    return embed ? formattedURL : `<${formattedURL}>`;
}

export function discordTimestamp(timestamp: number | string, type: "d" | "D" | "f" | "F" | "R" | "t" | "T"): string {
    return `<t:${timestamp}:${type}>`;
}

export function currentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}

export function pluralize(str: string, count: number) {
    return count === 1 ? str : `${str}s`;
}

export const RegexPatterns = {
    DurationValidation: /^\d+\s*(d(ays?)?|h((ou)?rs?)?|min(ute)?s?|[hm])$/gi,
    RequestValidation: /^(?:<@!?)?(?<targetId>\d{17,19})>? ?(?<duration>\d{1,3}[mhd])? (?<reason>(?:.|[\n\r])+)/gmi,
    ChannelIdFromURL: /channels\/\d{17,19}\/(\d{17,19})\/\d{17,19}/gmi
};