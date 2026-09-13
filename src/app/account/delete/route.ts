import { handleAccountDeletePost } from "@/lib/account-delete-route";

export async function POST(request: Request): Promise<Response> {
  return handleAccountDeletePost(request);
}
