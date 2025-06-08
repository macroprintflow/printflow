
'use server';
/**
 * @fileOverview An AI flow to assist with production planning by suggesting job assignments to departments.
 *
 * - suggestProductionPlan - A function that generates a production plan.
 * - ProductionPlanningInput - The input type for the suggestProductionPlan function.
 * - ProductionPlanningOutput - The return type for the suggestProductionPlan function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { JobCardData } from '@/lib/definitions'; // Assuming JobCardData is the correct type for job details

// Schema for individual job details relevant to planning
const PlanningJobSchema = z.object({
  id: z.string().describe("Unique identifier for the job card."),
  jobName: z.string().describe("Name of the job."),
  jobCardNumber: z.string().optional().describe("The unique job card number."),
  date: z.string().describe("Date the job card was created (ISO format)."),
  customerName: z.string().describe("Name of the customer."),
  netQuantity: z.number().describe("Net quantity required for the job."),
  dispatchDate: z.string().optional().describe("Target dispatch date for the job (ISO format)."),
  currentDepartment: z.string().optional().describe("The department the job is currently in, if any."),
  status: z.string().optional().describe("Current status of the job (e.g., 'Pending Planning', 'In Printing')."),
  linkedJobCardIds: z.array(z.string()).optional().describe("IDs of other job cards that are linked to this one (e.g., components of a rigid box that must be processed together). These jobs might need to be processed concurrently or sequentially with the current job. The AI should consider the status and requirements of these linked jobs when planning."),
  // Add other fields that might be relevant for AI planning decisions
  // For example: paperQuality, kindOfJob, complexityScore (if available)
});

const DepartmentLoadSchema = z.object({
    departmentName: z.string().describe("Name of the production department/step."),
    currentQueueJobIds: z.array(z.string()).describe("List of job IDs currently queued or in progress in this department."),
    capacityPerDay: z.number().optional().describe("Estimated number of jobs this department can process per day."),
});

const ProductionPlanningInputSchema = z.object({
  jobsToPlan: z.array(PlanningJobSchema).describe("A list of jobs that need to be scheduled or assigned to a department."),
  departmentStatus: z.array(DepartmentLoadSchema).describe("Current load and capacity information for each relevant production department."),
  planningHorizonDays: z.number().int().positive().describe("Number of days ahead to plan for (e.g., 1 for today, 2 for today and tomorrow)."),
  planningDate: z.string().describe("The starting date for this planning cycle (ISO format, e.g., YYYY-MM-DD). Jobs should be planned for this date or later within the horizon."),
});
export type ProductionPlanningInput = z.infer<typeof ProductionPlanningInputSchema>;

const SuggestedAssignmentSchema = z.object({
  jobId: z.string().describe("The ID of the job being assigned."),
  jobCardNumber: z.string().optional().describe("The job card number for easy reference."),
  assignedDepartment: z.string().describe("The name of the department the job should be assigned to."),
  targetDate: z.string().describe("The suggested date (YYYY-MM-DD) for this job to be processed in the assigned department."),
  priority: z.number().int().min(1).max(10).describe("Suggested priority for the job within the department (1=highest, 10=lowest)."),
  reasoning: z.string().describe("Brief explanation for why this assignment and priority were chosen (e.g., 'Old job, high priority', 'Depends on Job X completion', 'Fits available capacity', 'Component Job Y needs to catch up for Main Job Z')."),
  interdependenciesConsidered: z.array(z.string()).optional().describe("List of linked job IDs that were considered in this planning decision."),
});

const ProductionPlanningOutputSchema = z.object({
  suggestedAssignments: z.array(SuggestedAssignmentSchema).describe("An array of suggested job assignments, ordered by target date and then priority."),
  planningSummary: z.string().optional().describe("A brief overall summary of the plan or any key considerations, especially regarding interlinked jobs."),
});
export type ProductionPlanningOutput = z.infer<typeof ProductionPlanningOutputSchema>;


export async function suggestProductionPlan(input: ProductionPlanningInput): Promise<ProductionPlanningOutput> {
  return productionPlanningFlow(input);
}

const prompt = ai.definePrompt({
  name: 'productionPlanningPrompt',
  input: {schema: ProductionPlanningInputSchema},
  output: {schema: ProductionPlanningOutputSchema},
  prompt: `You are an expert production planner for a printing and packaging facility.
Your task is to create a suggested production plan for the next {{planningHorizonDays}} day(s), starting from {{planningDate}}.
You will be given a list of jobs that need to be planned ('jobsToPlan') and the current status/load of various departments ('departmentStatus').

Key Objectives:
1.  **Meet Dispatch Dates:** Prioritize jobs to ensure they meet their 'dispatchDate' if provided.
2.  **Process Old Jobs:** Give higher priority to older jobs (based on 'date' created).
3.  **Handle Interlinked Jobs CRITICALLY:** If a job has 'linkedJobCardIds', these represent components that *must* be processed together or in a specific sequence for a final product (e.g., a rigid box and its wrappers, or a main product and its inserts).
    *   **Analyze Dependencies:** For each job in 'jobsToPlan', if it's part of a linked set (either it has `linkedJobCardIds` or its ID appears in another job's `linkedJobCardIds`), you MUST examine the status of ALL jobs in that set.
    *   **Identify Bottlenecks:** If a main job (e.g., "Rigid Box Assembly") is ready for a department but its linked component jobs (e.g., "Top Wrapper," "Bottom Kappa") are not yet complete or are far behind in the production flow (e.g., still in "Printing" when the main job needs "Box Making"), you MUST prioritize getting those lagging component jobs to the necessary preceding stages.
    *   **Suggestive Prioritization for Components:** For example, if "Rigid Box Tray" (jobId: main-box-123) needs "Top Wrapper" (jobId: top-wrapper-456) and "Bottom Kappa" (jobId: bottom-kappa-789) for assembly, and "Top Wrapper" is still in "Printing" while "Bottom Kappa" is in "Die Cutting", and "Rigid Box Tray" is otherwise ready for "Box Making & Assembly", you should suggest a plan that advances "Top Wrapper" and "Bottom Kappa" through their respective next steps with appropriate priority.
    *   The 'reasoning' for such jobs should explicitly state how linked jobs influenced the decision (e.g., "Prioritizing Top Wrapper for Printing to align with Rigid Box Tray assembly schedule.").
    *   List the IDs of linked jobs considered in 'interdependenciesConsidered'.
4.  **Balance Departmental Load:** Consider the 'currentQueueJobIds' and 'capacityPerDay' (if available) for each department to avoid overloading any single department.
5.  **Logical Flow:** Assign jobs to departments in a logical production sequence. A job typically moves from an earlier stage to a later stage. Do not assign a job to a department it has already completed unless it's a rework scenario (not covered here). Assume jobs in 'jobsToPlan' are ready for their *next* logical step or are new.

Input Data:
- Jobs to Plan: {{jsonEncode jobsToPlan}}
- Department Status: {{jsonEncode departmentStatus}}
- Planning Horizon: {{planningHorizonDays}} day(s)
- Planning Start Date: {{planningDate}}

Instructions for each job in 'jobsToPlan':
- Determine the most logical 'assignedDepartment' for its next step.
- Assign a 'targetDate' within the planning horizon, starting from 'planningDate'.
- Assign a 'priority' (1-10, 1 is highest). Consider urgency (dispatch dates, age) and interdependencies.
- Provide 'reasoning' for your decisions, especially highlighting how linked jobs impacted the plan.

Output Format:
Return a JSON object strictly adhering to the ProductionPlanningOutputSchema.
The 'suggestedAssignments' array should be sorted primarily by 'targetDate' (earliest first) and secondarily by 'priority' (highest first).
If no jobs can be reasonably planned (e.g., all departments overloaded, critical dependencies for linked jobs missing and unplannable), the 'suggestedAssignments' array can be empty, and you should explain why in the 'planningSummary'.

Consider the typical production flow:
Job Approval -> Cutter -> Printing (Front/Back) -> Coating (Texture UV/Lamination) -> Die Cutting -> Foil Stamping -> Emboss (if any) -> Pasting -> Box Making & Assembly -> Packing -> To be Billed.
A job's current status or details (like 'kindOfJob' or specific processes mentioned in its original card if available in PlanningJobSchema) can help determine its next logical department.

If a job is new (e.g. status 'Pending Planning' or no currentDepartment), its first assignment will likely be 'Job Approval' or 'Cutter' or 'Printing' depending on its nature.
If a job has a 'currentDepartment' and 'status' indicating completion of that stage, plan it for the next logical department.
When dealing with a set of interlinked jobs, if one job is significantly behind (e.g., Job A is in 'Box Making', but linked Job B is still in 'Printing'), the plan *must* prioritize accelerating Job B.
`,
});

const productionPlanningFlow = ai.defineFlow(
  {
    name: 'productionPlanningFlow',
    inputSchema: ProductionPlanningInputSchema,
    outputSchema: ProductionPlanningOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    
    if (!output) {
        return { suggestedAssignments: [], planningSummary: "AI did not return a valid plan." };
    }
    if (!output.suggestedAssignments) {
        output.suggestedAssignments = [];
    }

    output.suggestedAssignments.sort((a, b) => {
        if (a.targetDate < b.targetDate) return -1;
        if (a.targetDate > b.targetDate) return 1;
        return a.priority - b.priority;
    });

    return output;
  }
);

