import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("authenticate pilot account", async ({ page }) => {
  const emailAddress = process.env.E2E_USER_EMAIL;
  expect(emailAddress, "E2E_USER_EMAIL must identify a dedicated Clerk test user").toBeTruthy();
  await clerkSetup();
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: emailAddress! });
  await page.context().storageState({ path: authFile });
});
