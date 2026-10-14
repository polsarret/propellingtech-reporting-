import { getIncomeRecognitionByProject } from "@/lib/bigquery";
import { defaultClosingPeriod } from "@/lib/period";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const client = searchParams.get("client");
  const def = defaultClosingPeriod();
  const year = parseInt(searchParams.get("year") ?? "", 10) || def.year;
  const month = parseInt(searchParams.get("month") ?? "", 10) || def.month;

  if (!client) {
    return Response.json({ error: "Missing 'client' parameter" }, { status: 400 });
  }
  if (month < 1 || month > 12) {
    return Response.json({ error: "Invalid 'month' parameter" }, { status: 400 });
  }

  try {
    const projects = await getIncomeRecognitionByProject(year, month, client);
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
