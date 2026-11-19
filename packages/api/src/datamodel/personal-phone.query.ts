import { sql } from "drizzle-orm";
import {
  travelerProfiles,
  tripMemberships,
  tripRegistrations,
} from "../schema";

// NULL defers to the imported registration; an empty override clears the number.
export const personalPhone = sql<string | null>`coalesce(
  ${travelerProfiles.personalPhone},
  (select trim(${tripRegistrations.sourcePhone})
   from ${tripRegistrations}
   where ${tripRegistrations.tripId} = ${tripMemberships.tripId}
     and ${tripRegistrations.userId} = ${tripMemberships.userId}
     and ${tripRegistrations.status} = 'validated'
     and trim(${tripRegistrations.sourcePhone}) <> ''
   order by ${tripRegistrations.lastImportedAt} desc, ${tripRegistrations.reference}
   limit 1)
)`;
