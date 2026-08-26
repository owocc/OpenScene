import { redirect } from "next/navigation";
import { getServerSessionAndOrganizations } from "../server/auth";

export default async function HomePage() {
  const { isAuthenticated, isAuthDisabled, activeOrgId, organizations } =
    await getServerSessionAndOrganizations();

  if (!isAuthenticated && !isAuthDisabled) {
    redirect("/login");
  }

  if (isAuthDisabled) {
    redirect("/default/apps");
  }

  if (organizations.length === 0) {
    redirect("/organization/select");
  }

  if (organizations.length === 1) {
    redirect(`/${organizations[0].slug}/apps`);
  }

  const matchedActive = activeOrgId ? organizations.find((o) => o.id === activeOrgId) : undefined;
  if (matchedActive) {
    redirect(`/${matchedActive.slug}/apps`);
  }

  redirect("/organization/select");
}
