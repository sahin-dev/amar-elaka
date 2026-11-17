import { getI18n } from "@/i18n/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        icon="search"
        title={t.common.notFoundTitle}
        body={t.common.notFoundBody}
        action={<ButtonLink href="/">{t.common.goHome}</ButtonLink>}
      />
    </div>
  );
}
