import { db } from "@/db";
import { one } from "@/db/one";
import { contacts, deals, activities, pipelineStages } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ContactDetailClient } from "@/components/contacts/ContactDetail";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const contact = (await one(db.select().from(contacts).where(eq(contacts.id, id))));
  if (!contact) notFound();

  const stages = (await db
    .select({
      id: pipelineStages.id,
      name: pipelineStages.name,
      color: pipelineStages.color,
      nextAction: pipelineStages.nextAction,
    })
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order))
    );

  const contactDeals = (await db
    .select({
      id: deals.id,
      title: deals.title,
      value: deals.value,
      stageId: deals.stageId,
      probability: deals.probability,
      createdAt: deals.createdAt,
      stageName: pipelineStages.name,
      stageColor: pipelineStages.color,
    })
    .from(deals)
    .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(eq(deals.contactId, id))
    );

  const contactActivities = (await db
    .select()
    .from(activities)
    .where(eq(activities.contactId, id))
    .orderBy(desc(activities.createdAt))
    );

  return (
    <ContactDetailClient
      contact={contact as Parameters<typeof ContactDetailClient>[0]["contact"]}
      stages={stages}
      deals={contactDeals as Parameters<typeof ContactDetailClient>[0]["deals"]}
      activities={contactActivities as Parameters<typeof ContactDetailClient>[0]["activities"]}
    />
  );
}
