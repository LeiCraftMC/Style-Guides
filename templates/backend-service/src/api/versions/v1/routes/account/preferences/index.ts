import { Hono } from "hono";
import { AccountPreferencesModel } from "./model"
import { validator } from "hono-openapi";
import { APIResponse } from "../../../../../utils/api-res";
import { APIResponseSpec, APIRouteSpec } from "../../../../../utils/specHelpers";
import { AuthHandler } from "../../../../../utils/authHandler";
import { UserPreferencesHandler } from "../../../../../utils/preferences";
import { DOCS_TAGS } from "../../../docs";

export const router = new Hono().basePath('/preferences');

// something

router.get('/onboarding',

    APIRouteSpec.authenticated({
        summary: "Get onboarding state",
        description: "Retrieve whether the authenticated user has completed the one-time, platform-wide welcome onboarding.",
        tags: [DOCS_TAGS.ACCOUNT_PREFERENCES],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success("Onboarding state retrieved successfully", AccountPreferencesModel.Onboarding.Response),
        )
    }),

    async (c) => {
        const authContext = AuthHandler.AuthContext.getAsSession(c);

        const preference = await UserPreferencesHandler.getOnboarding(authContext.user_id);

        return APIResponse.success(c, "Onboarding state retrieved successfully", preference);
    }

);

router.put('/onboarding',

    APIRouteSpec.authenticated({
        summary: "Update onboarding state",
        description: "Set whether the authenticated user has completed the one-time, platform-wide welcome onboarding.",
        tags: [DOCS_TAGS.ACCOUNT_PREFERENCES],

        responses: APIResponseSpec.describeWithWrongInputs(
            APIResponseSpec.successNoData("Onboarding state updated successfully"),
        )
    }),

    validator("json", AccountPreferencesModel.Onboarding.Body),

    async (c) => {
        const authContext = AuthHandler.AuthContext.getAsSession(c);

        const body = c.req.valid("json");

        await UserPreferencesHandler.setOnboarding(authContext.user_id, body);

        return APIResponse.successNoData(c, "Onboarding state updated successfully");
    }

);