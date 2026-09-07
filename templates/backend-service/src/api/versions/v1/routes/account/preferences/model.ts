
import { z } from "zod";
import { UserPreferences } from "../../../../../utils/preferences";

// something

export namespace AccountPreferencesModel.Onboarding {

    export const Response = UserPreferences.schemas["onboarding"];
    export type Response = z.infer<typeof Response>;

    export const Body = Response;
    export type Body = z.infer<typeof Body>;

}