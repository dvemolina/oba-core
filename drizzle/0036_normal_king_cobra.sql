ALTER TABLE "booking_participants" DROP CONSTRAINT "booking_participants_booking_client_id_fkey";
--> statement-breakpoint
ALTER TABLE "service_editions" DROP CONSTRAINT "service_editions_service_id_services_id_fk";
--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_client_id_booking_clients_id_fk" FOREIGN KEY ("booking_client_id") REFERENCES "public"."booking_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_editions" ADD CONSTRAINT "service_editions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "price_override";