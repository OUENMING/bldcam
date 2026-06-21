import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

function generateSlug(title) {
  let slug = title.trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
  slug = slug.replace(/[\s—–\-–_.,;:!?@#$%^&*()+=[\]{}|\\/"'`~<>]+/g, "-");
  slug = slug.replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
  if (!slug) slug = "photo";
  const suffix = randomUUID().slice(0, 4);
  return slug + "-" + suffix;
}

const photos = await prisma.photo.findMany();
let sql = "";
for (const p of photos) {
  const slug = generateSlug(p.title);
  sql += `UPDATE Photo SET slug = '${slug.replace(/'/g, "''")}' WHERE id = '${p.id}';\n`;
  console.log(`${p.title} -> ${slug}`);
}
await prisma.$disconnect();

import { writeFileSync } from "fs";
writeFileSync("/tmp/slug-migration.sql", sql);
console.log(`\n${photos.length} slugs written to /tmp/slug-migration.sql`);
