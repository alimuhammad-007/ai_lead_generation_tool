"use server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { revalidatePath } = require("next/cache") as { revalidatePath: (path: string) => void };
import { createAdminClient } from "@/lib/supabase";

export type CreateClientInput = {
  name: string;
  email: string;
  company: string;
};

export async function createClient(input: CreateClientInput) {
  const { name, email, company } = input;

  if (!name.trim() || !email.trim() || !company.trim()) {
    throw new Error("Name, email, and company are required.");
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) throw new Error("Invalid email address.");

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company.trim(),
      plan: "free",
      subscription_status: "trialing",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("A client with this email already exists.");
    throw new Error(error.message);
  }

  revalidatePath("/clients");
  return data;
}
