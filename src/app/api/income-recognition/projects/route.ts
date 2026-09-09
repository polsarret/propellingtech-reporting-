import { getIncomeRecognitionByProject } from "@/lib/bigquery";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const client = searchParams.get("client");
  const year = parseInt(searchParams.get("year") || "2026", 10);

  if (!client) {
    return Response.json({ error: "Missing 'client' parameter" }, { status: 400 });
  }

  try {
    const projects = await getIncomeRecognitionByProject(year, client);
    return Response.json(projects);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching projects:", errorMessage, error);
    return Response.json({ 
      error: "Failed to fetch projects",
      details: errorMessage 
    }, { status: 500 });
  }
}
