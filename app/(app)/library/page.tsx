import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { getLibrary } from "@/lib/library-data";
import LibraryClient from "@/components/LibraryClient";
import LibraryTabs from "@/components/LibraryTabs";

export default async function LibraryPage() {
  const user = await getAuthedUser();
  if (!user) redirect("/login");

  const { spaces, items } = await getLibrary(user.id);
  return (
    <>
      <LibraryTabs />
      <LibraryClient spaces={spaces} items={items} />
    </>
  );
}
