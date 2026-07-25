import { prisma } from "../../src/client";

export async function seedAssets() {
  await prisma.user.createMany({
    data: [
      {
        user_id: "usr_6q9g3syt014",
        first_name: "punit",
        last_name: "pawar",
        age: 23,
        email: "email.com",
        phone: "+91 9098929549",
        password: "hashedPassword1",
      },
      {
        user_id: "usr_xslwr9hnet",
        first_name: "test",
        last_name: "test",
        age: 23,
        email: "test.com",
        phone: "+92 9098929549",
        password: "hashedPassword1",
      },
    ],
    skipDuplicates: true,
  });
  console.log("Assets seeded ✓");
}
