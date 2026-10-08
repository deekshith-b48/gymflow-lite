import { query } from "./_generated/server";
import { requireStaff } from "./staff";
import { startOfDay } from "../lib/gym";

const DAY_MS = 86_400_000;

/**
 * One query behind both the workspace dashboard and the admin area: the desk
 * numbers, the catalog, the schedule, revenue and content, all reactive.
 */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireStaff(ctx);
    const now = Date.now();
    const todayStart = startOfDay(now);
    const monthStart = now - 30 * DAY_MS;

    const [members, checkIns, sessions, orders, posts, items, myBookings] =
      await Promise.all([
        ctx.db.query("members").collect(),
        ctx.db
          .query("checkIns")
          .withIndex("by_at", (q) => q.gte("at", todayStart))
          .collect(),
        ctx.db
          .query("sessions")
          .withIndex("by_startsAt", (q) => q.gte("startsAt", now - 3_600_000))
          .order("asc")
          .take(20),
        ctx.db.query("orders").order("desc").take(200),
        ctx.db.query("posts").order("desc").take(50),
        ctx.db.query("catalogItems").collect(),
        ctx.db
          .query("bookings")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
      ]);

    const paid = orders.filter((order) => order.status === "paid");
    const published = items.filter((item) => item.status === "published");

    return {
      roster: {
        total: members.length,
        active: members.filter((member) => member.status === "active").length,
        checkedInToday: checkIns.length,
        duesOutstandingCents: members.reduce(
          (sum, member) => sum + Math.max(0, member.duesAmountCents),
          0,
        ),
      },
      catalog: {
        total: items.length,
        published: published.length,
        drafts: items.filter((item) => item.status === "draft").length,
        averagePriceCents: published.length
          ? Math.round(
              published.reduce((sum, item) => sum + item.priceCents, 0) /
                published.length,
            )
          : 0,
      },
      revenue: {
        todayCents: paid
          .filter((order) => order.createdAt >= todayStart)
          .reduce((sum, order) => sum + order.amountCents, 0),
        revenue30dCents: paid
          .filter((order) => order.createdAt >= monthStart)
          .reduce((sum, order) => sum + order.amountCents, 0),
        pendingCents: orders
          .filter((order) => order.status === "pending")
          .reduce((sum, order) => sum + order.amountCents, 0),
        paidCount: paid.length,
        recentOrders: orders.slice(0, 5).map((order) => ({
          _id: order._id,
          itemName: order.itemName,
          amountCents: order.amountCents,
          status: order.status,
          method: order.method,
          reference: order.reference,
          createdAt: order.createdAt,
        })),
      },
      schedule: {
        upcoming: sessions.length,
        nextSession: sessions[0]
          ? {
              _id: sessions[0]._id,
              title: sessions[0].title,
              coach: sessions[0].coach,
              room: sessions[0].room,
              startsAt: sessions[0].startsAt,
              capacity: sessions[0].capacity,
            }
          : null,
        myBookings: myBookings.filter((booking) => booking.status !== "cancelled")
          .length,
      },
      content: {
        published: posts.filter((post) => post.published).length,
        drafts: posts.filter((post) => !post.published).length,
        latest: posts[0]
          ? {
              _id: posts[0]._id,
              title: posts[0].title,
              kind: posts[0].kind,
              published: posts[0].published,
              authorName: posts[0].authorName,
              createdAt: posts[0]._creationTime,
            }
          : null,
      },
    };
  },
});
