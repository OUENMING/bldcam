import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/components/admin/login-form";
import { AdminConsole } from "@/components/admin/admin-console";

export default async function AdminPage() {
  const authed = await isAdmin();

  if (!authed) {
    return <LoginForm />;
  }

  const photos = await prisma.photo.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <AdminConsole initialPhotos={photos} />;
}
