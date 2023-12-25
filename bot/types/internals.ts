export enum ErrorCause {
    DuplicateRequest = "DuplicateRequest",
}

export interface RegexPattern {
    pattern: RegExp,
    returnedFields: ReadonlyArray<string>
}

export type ExtractFuncResult<T extends RegexPattern> = Partial<Record<T["returnedFields"][number], string>>;

/** Equivalent to {@link InstanceType} but for abstract classes. */
export type AbstractInstanceType<T> = T extends { prototype: infer U } ? U : never;