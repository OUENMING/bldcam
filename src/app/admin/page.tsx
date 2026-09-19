import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/components/admin/login-form";
import { AdminConsole } from "@/components/admin/admin-console";

/** The console's working set. Anything older is simply not listed — no paging. */
const ADMIN_PHOTO_LIMIT = 200;

export default async function AdminPage() {
  // Auth on its own, first. Running the query inside the same Promise.all meant an
  // anonymous visit still read 200 photo rows before the check ran, and it put a
  // protected read ahead of the decision that protects it.
  if (!(await isAdmin())) {
    return <LoginForm />;
  }

  let photos;
  try {
    photos = await prisma.photo.findMany({
      orderBy: { createdAt: "desc" },
      // Named, and deliberately not paginated: the console edits a fixed working set,
      // and anything past this is silently absent from the list.
      take: ADMIN_PHOTO_LIMIT,
    });
  } catch (error) {
    // A database hiccup should say so rather than hand the admin a blank 500 page.
    console.error("Admin page: photo query failed:", error);
    return (
      <p className="p-6 text-muted-foreground">加载照片失败，请刷新重试。</p>
    );
  }

  return <AdminConsole initialPhotos={photos} />;
}
