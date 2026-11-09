
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "api_keys": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"key_hash": string,"key_prefix": string,"last_used_at": string | null,"name": string,"organization_id": string,"restaurant_id": string | null,"revoked_at": string | null,"scopes": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"key_hash": string,"key_prefix": string,"last_used_at"?: string | null,"name": string,"organization_id": string,"restaurant_id"?: string | null,"revoked_at"?: string | null,"scopes"?: (string)[]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"key_hash"?: string,"key_prefix"?: string,"last_used_at"?: string | null,"name"?: string,"organization_id"?: string,"restaurant_id"?: string | null,"revoked_at"?: string | null,"scopes"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "api_keys_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "api_keys_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "api_keys_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_label": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": string,"new_data": Json | null,"old_data": Json | null,"organization_id": string | null,"restaurant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_label"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: string,"new_data"?: Json | null,"old_data"?: Json | null,"organization_id"?: string | null,"restaurant_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_label"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"new_data"?: Json | null,"old_data"?: Json | null,"organization_id"?: string | null,"restaurant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_logs_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_policies": {
                  Row: {
                    "auto_confirm_online": boolean,"booking_terms": NonNullable<Json>,"buffer_minutes": number,"cancellation_cutoff_hours": number,"cancellation_policy": NonNullable<Json>,"created_at": string,"default_duration_minutes": number,"deposit_amount": number,"deposit_min_party_size": number,"deposit_type": Database["public"]['Enums']["deposit_type"],"duration_rules": NonNullable<Json>,"id": string,"large_party_threshold": number | null,"max_advance_days": number,"max_online_bookings_per_day": number | null,"max_online_covers_per_day": number | null,"max_party_size": number,"min_advance_minutes": number,"min_party_size": number,"modification_cutoff_hours": number,"no_show_fee_amount": number,"restaurant_id": string,"slot_interval_minutes": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_confirm_online"?: boolean,"booking_terms"?: NonNullable<Json>,"buffer_minutes"?: number,"cancellation_cutoff_hours"?: number,"cancellation_policy"?: NonNullable<Json>,"created_at"?: string,"default_duration_minutes"?: number,"deposit_amount"?: number,"deposit_min_party_size"?: number,"deposit_type"?: Database["public"]['Enums']["deposit_type"],"duration_rules"?: NonNullable<Json>,"id"?: string,"large_party_threshold"?: number | null,"max_advance_days"?: number,"max_online_bookings_per_day"?: number | null,"max_online_covers_per_day"?: number | null,"max_party_size"?: number,"min_advance_minutes"?: number,"min_party_size"?: number,"modification_cutoff_hours"?: number,"no_show_fee_amount"?: number,"restaurant_id": string,"slot_interval_minutes"?: number,"updated_at"?: string
                  }
                  Update: {
                    "auto_confirm_online"?: boolean,"booking_terms"?: NonNullable<Json>,"buffer_minutes"?: number,"cancellation_cutoff_hours"?: number,"cancellation_policy"?: NonNullable<Json>,"created_at"?: string,"default_duration_minutes"?: number,"deposit_amount"?: number,"deposit_min_party_size"?: number,"deposit_type"?: Database["public"]['Enums']["deposit_type"],"duration_rules"?: NonNullable<Json>,"id"?: string,"large_party_threshold"?: number | null,"max_advance_days"?: number,"max_online_bookings_per_day"?: number | null,"max_online_covers_per_day"?: number | null,"max_party_size"?: number,"min_advance_minutes"?: number,"min_party_size"?: number,"modification_cutoff_hours"?: number,"no_show_fee_amount"?: number,"restaurant_id"?: string,"slot_interval_minutes"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_policies_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: true
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_requests": {
                  Row: {
                    "channel": string,"created_at": string,"created_by": string | null,"customer_name": string,"decline_reason": string | null,"handled_at": string | null,"handled_by": string | null,"id": string,"line_id": string | null,"notes": string | null,"organization_id": string,"party_size": number,"phone": string | null,"requested_date": string,"requested_time": string,"reservation_id": string | null,"restaurant_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel"?: string,"created_at"?: string,"created_by"?: string | null,"customer_name": string,"decline_reason"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"line_id"?: string | null,"notes"?: string | null,"organization_id"?: string,"party_size": number,"phone"?: string | null,"requested_date": string,"requested_time": string,"reservation_id"?: string | null,"restaurant_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"created_by"?: string | null,"customer_name"?: string,"decline_reason"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"line_id"?: string | null,"notes"?: string | null,"organization_id"?: string,"party_size"?: number,"phone"?: string | null,"requested_date"?: string,"requested_time"?: string,"reservation_id"?: string | null,"restaurant_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: []
                },"booking_sources": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"is_system": boolean,"name": string,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"is_system"?: boolean,"name": string,"organization_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"is_system"?: boolean,"name"?: string,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_sources_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_types": {
                  Row: {
                    "created_at": string,"deposit_override": number | null,"description": Json | null,"duration_minutes": number | null,"id": string,"is_active": boolean,"is_online": boolean,"max_party_size": number | null,"min_party_size": number | null,"name": NonNullable<Json>,"price": number | null,"restaurant_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deposit_override"?: number | null,"description"?: Json | null,"duration_minutes"?: number | null,"id"?: string,"is_active"?: boolean,"is_online"?: boolean,"max_party_size"?: number | null,"min_party_size"?: number | null,"name": NonNullable<Json>,"price"?: number | null,"restaurant_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deposit_override"?: number | null,"description"?: Json | null,"duration_minutes"?: number | null,"id"?: string,"is_active"?: boolean,"is_online"?: boolean,"max_party_size"?: number | null,"min_party_size"?: number | null,"name"?: NonNullable<Json>,"price"?: number | null,"restaurant_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_types_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_consents": {
                  Row: {
                    "consent_type": string,"created_at": string,"customer_id": string,"granted": boolean,"id": string,"policy_version": string,"recorded_by": string | null,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_type": string,"created_at"?: string,"customer_id": string,"granted": boolean,"id"?: string,"policy_version"?: string,"recorded_by"?: string | null,"source"?: string
                  }
                  Update: {
                    "consent_type"?: string,"created_at"?: string,"customer_id"?: string,"granted"?: boolean,"id"?: string,"policy_version"?: string,"recorded_by"?: string | null,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_consents_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customer_consents_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_tag_assignments": {
                  Row: {
                    "created_at": string,"customer_id": string,"tag_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"customer_id": string,"tag_id": string
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_tag_assignments_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customer_tag_assignments_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "customer_tags"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_tags": {
                  Row: {
                    "color": string,"created_at": string,"id": string,"name": string,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"id"?: string,"name": string,"organization_id": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"id"?: string,"name"?: string,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_tags_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "allergies": string | null,"anonymized_at": string | null,"birthday": string | null,"created_at": string,"dietary_preferences": string | null,"email": string | null,"email_normalized": string | null,"first_visit_at": string | null,"full_name": string,"id": string,"internal_notes": string | null,"is_vip": boolean,"last_visit_at": string | null,"line_user_id": string | null,"organization_id": string,"phone": string | null,"phone_normalized": string | null,"preferred_language": string,"special_requests": string | null,"total_cancellations": number,"total_no_shows": number,"total_visits": number,"updated_at": string,"vip_note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allergies"?: string | null,"anonymized_at"?: string | null,"birthday"?: string | null,"created_at"?: string,"dietary_preferences"?: string | null,"email"?: string | null,"email_normalized"?: never,"first_visit_at"?: string | null,"full_name": string,"id"?: string,"internal_notes"?: string | null,"is_vip"?: boolean,"last_visit_at"?: string | null,"line_user_id"?: string | null,"organization_id": string,"phone"?: string | null,"phone_normalized"?: string | null,"preferred_language"?: string,"special_requests"?: string | null,"total_cancellations"?: number,"total_no_shows"?: number,"total_visits"?: number,"updated_at"?: string,"vip_note"?: string | null
                  }
                  Update: {
                    "allergies"?: string | null,"anonymized_at"?: string | null,"birthday"?: string | null,"created_at"?: string,"dietary_preferences"?: string | null,"email"?: string | null,"email_normalized"?: never,"first_visit_at"?: string | null,"full_name"?: string,"id"?: string,"internal_notes"?: string | null,"is_vip"?: boolean,"last_visit_at"?: string | null,"line_user_id"?: string | null,"organization_id"?: string,"phone"?: string | null,"phone_normalized"?: string | null,"preferred_language"?: string,"special_requests"?: string | null,"total_cancellations"?: number,"total_no_shows"?: number,"total_visits"?: number,"updated_at"?: string,"vip_note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_capacity": {
                  Row: {
                    "capacity": number | null,"day": string,"note": string | null,"restaurant_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number | null,"day": string,"note"?: string | null,"restaurant_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "capacity"?: number | null,"day"?: string,"note"?: string | null,"restaurant_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: []
                },"data_subject_requests": {
                  Row: {
                    "created_at": string,"customer_id": string | null,"id": string,"notes": string | null,"organization_id": string,"processed_at": string | null,"processed_by": string | null,"request_type": Database["public"]['Enums']["dsr_type"],"requester_contact": string | null,"status": Database["public"]['Enums']["dsr_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"customer_id"?: string | null,"id"?: string,"notes"?: string | null,"organization_id": string,"processed_at"?: string | null,"processed_by"?: string | null,"request_type": Database["public"]['Enums']["dsr_type"],"requester_contact"?: string | null,"status"?: Database["public"]['Enums']["dsr_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"customer_id"?: string | null,"id"?: string,"notes"?: string | null,"organization_id"?: string,"processed_at"?: string | null,"processed_by"?: string | null,"request_type"?: Database["public"]['Enums']["dsr_type"],"requester_contact"?: string | null,"status"?: Database["public"]['Enums']["dsr_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_subject_requests_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_subject_requests_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "data_subject_requests_processed_by_fkey"
      columns: ["processed_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"integrations": {
                  Row: {
                    "category": string,"config": NonNullable<Json>,"created_at": string,"display_name": string,"id": string,"last_checked_at": string | null,"last_error": string | null,"notes": string | null,"organization_id": string,"provider": string,"restaurant_id": string | null,"status": Database["public"]['Enums']["integration_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"config"?: NonNullable<Json>,"created_at"?: string,"display_name": string,"id"?: string,"last_checked_at"?: string | null,"last_error"?: string | null,"notes"?: string | null,"organization_id": string,"provider": string,"restaurant_id"?: string | null,"status"?: Database["public"]['Enums']["integration_status"],"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"config"?: NonNullable<Json>,"created_at"?: string,"display_name"?: string,"id"?: string,"last_checked_at"?: string | null,"last_error"?: string | null,"notes"?: string | null,"organization_id"?: string,"provider"?: string,"restaurant_id"?: string | null,"status"?: Database["public"]['Enums']["integration_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "integrations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "integrations_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_logs": {
                  Row: {
                    "attempts": number,"body": string,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"customer_id": string | null,"error": string | null,"event": Database["public"]['Enums']["notification_event"],"id": string,"locale": string,"max_attempts": number,"next_attempt_at": string | null,"organization_id": string,"provider": string | null,"provider_message_id": string | null,"recipient": string,"reservation_id": string | null,"restaurant_id": string | null,"sent_at": string | null,"status": Database["public"]['Enums']["notification_status"],"subject": string | null,"template_id": string | null,"updated_at": string,"waitlist_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"body": string,"channel": Database["public"]['Enums']["notification_channel"],"created_at"?: string,"customer_id"?: string | null,"error"?: string | null,"event": Database["public"]['Enums']["notification_event"],"id"?: string,"locale"?: string,"max_attempts"?: number,"next_attempt_at"?: string | null,"organization_id": string,"provider"?: string | null,"provider_message_id"?: string | null,"recipient": string,"reservation_id"?: string | null,"restaurant_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"subject"?: string | null,"template_id"?: string | null,"updated_at"?: string,"waitlist_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"body"?: string,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"customer_id"?: string | null,"error"?: string | null,"event"?: Database["public"]['Enums']["notification_event"],"id"?: string,"locale"?: string,"max_attempts"?: number,"next_attempt_at"?: string | null,"organization_id"?: string,"provider"?: string | null,"provider_message_id"?: string | null,"recipient"?: string,"reservation_id"?: string | null,"restaurant_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notification_status"],"subject"?: string | null,"template_id"?: string | null,"updated_at"?: string,"waitlist_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_logs_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_logs_reservation_id_fkey"
      columns: ["reservation_id"]
isOneToOne: false
      referencedRelation: "reservations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_logs_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_logs_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "notification_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_logs_waitlist_id_fkey"
      columns: ["waitlist_id"]
isOneToOne: false
      referencedRelation: "waitlists"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_templates": {
                  Row: {
                    "body": string,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"event": Database["public"]['Enums']["notification_event"],"id": string,"is_active": boolean,"locale": string,"organization_id": string,"restaurant_id": string | null,"subject": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"channel": Database["public"]['Enums']["notification_channel"],"created_at"?: string,"event": Database["public"]['Enums']["notification_event"],"id"?: string,"is_active"?: boolean,"locale"?: string,"organization_id": string,"restaurant_id"?: string | null,"subject"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"event"?: Database["public"]['Enums']["notification_event"],"id"?: string,"is_active"?: boolean,"locale"?: string,"organization_id"?: string,"restaurant_id"?: string | null,"subject"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_templates_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_templates_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"operating_hours": {
                  Row: {
                    "close_time": string | null,"created_at": string,"day_of_week": number | null,"id": string,"is_closed": boolean,"last_seating_time": string | null,"open_time": string | null,"restaurant_id": string,"service_name": string,"specific_date": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "close_time"?: string | null,"created_at"?: string,"day_of_week"?: number | null,"id"?: string,"is_closed"?: boolean,"last_seating_time"?: string | null,"open_time"?: string | null,"restaurant_id": string,"service_name"?: string,"specific_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "close_time"?: string | null,"created_at"?: string,"day_of_week"?: number | null,"id"?: string,"is_closed"?: boolean,"last_seating_time"?: string | null,"open_time"?: string | null,"restaurant_id"?: string,"service_name"?: string,"specific_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "operating_hours_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"default_currency": string,"default_timezone": string,"id": string,"name": string,"page_access": Json,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_currency"?: string,"default_timezone"?: string,"id"?: string,"name": string,"page_access"?: Json,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"default_currency"?: string,"default_timezone"?: string,"id"?: string,"name"?: string,"page_access"?: Json,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"checkout_url": string | null,"created_at": string,"currency": string,"id": string,"kind": Database["public"]['Enums']["payment_kind"],"note": string | null,"organization_id": string,"paid_at": string | null,"provider": string,"provider_reference": string | null,"recorded_by": string | null,"reservation_id": string | null,"restaurant_id": string,"status": Database["public"]['Enums']["payment_txn_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"checkout_url"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"kind": Database["public"]['Enums']["payment_kind"],"note"?: string | null,"organization_id": string,"paid_at"?: string | null,"provider": string,"provider_reference"?: string | null,"recorded_by"?: string | null,"reservation_id"?: string | null,"restaurant_id": string,"status"?: Database["public"]['Enums']["payment_txn_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"checkout_url"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["payment_kind"],"note"?: string | null,"organization_id"?: string,"paid_at"?: string | null,"provider"?: string,"provider_reference"?: string | null,"recorded_by"?: string | null,"reservation_id"?: string | null,"restaurant_id"?: string,"status"?: Database["public"]['Enums']["payment_txn_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_reservation_id_fkey"
      columns: ["reservation_id"]
isOneToOne: false
      referencedRelation: "reservations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"refunds": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"payment_id": string,"processed_at": string | null,"processed_by": string | null,"provider_reference": string | null,"reason": string | null,"status": Database["public"]['Enums']["refund_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"payment_id": string,"processed_at"?: string | null,"processed_by"?: string | null,"provider_reference"?: string | null,"reason"?: string | null,"status"?: Database["public"]['Enums']["refund_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"payment_id"?: string,"processed_at"?: string | null,"processed_by"?: string | null,"provider_reference"?: string | null,"reason"?: string | null,"status"?: Database["public"]['Enums']["refund_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_processed_by_fkey"
      columns: ["processed_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"reservation_history": {
                  Row: {
                    "actor_label": string | null,"change_type": string,"changed_by": string | null,"changes": NonNullable<Json>,"created_at": string,"from_status": Database["public"]['Enums']["reservation_status"] | null,"id": string,"reservation_id": string,"to_status": Database["public"]['Enums']["reservation_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_label"?: string | null,"change_type": string,"changed_by"?: string | null,"changes"?: NonNullable<Json>,"created_at"?: string,"from_status"?: Database["public"]['Enums']["reservation_status"] | null,"id"?: string,"reservation_id": string,"to_status"?: Database["public"]['Enums']["reservation_status"] | null
                  }
                  Update: {
                    "actor_label"?: string | null,"change_type"?: string,"changed_by"?: string | null,"changes"?: NonNullable<Json>,"created_at"?: string,"from_status"?: Database["public"]['Enums']["reservation_status"] | null,"id"?: string,"reservation_id"?: string,"to_status"?: Database["public"]['Enums']["reservation_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reservation_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservation_history_reservation_id_fkey"
      columns: ["reservation_id"]
isOneToOne: false
      referencedRelation: "reservations"
      referencedColumns: ["id"]
    }
                  ]
                },"reservation_tables": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"period": unknown,"reservation_id": string,"restaurant_id": string,"table_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"period": unknown,"reservation_id": string,"restaurant_id": string,"table_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"period"?: unknown,"reservation_id"?: string,"restaurant_id"?: string,"table_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reservation_tables_reservation_id_fkey"
      columns: ["reservation_id"]
isOneToOne: false
      referencedRelation: "reservations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservation_tables_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservation_tables_table_id_fkey"
      columns: ["table_id"]
isOneToOne: false
      referencedRelation: "tables"
      referencedColumns: ["id"]
    }
                  ]
                },"reservations": {
                  Row: {
                    "allergies": string | null,"arrived_at": string | null,"booking_source_id": string | null,"booking_type_id": string | null,"cancellation_reason": string | null,"cancelled_at": string | null,"completed_at": string | null,"confirmed_at": string | null,"created_at": string,"created_by": string | null,"customer_id": string | null,"customer_name": string,"deposit_amount": number,"dietary_requirements": string | null,"duration_minutes": number,"email": string | null,"ends_at": string,"guest_notes": string | null,"id": string,"internal_notes": string | null,"is_walk_in": boolean,"language": string,"manage_token_hash": string | null,"no_show_at": string | null,"organization_id": string,"party_size": number,"payment_status": Database["public"]['Enums']["payment_status"],"phone": string | null,"policy_accepted_at": string | null,"reference": string,"reminder_sent_at": string | null,"reservation_date": string,"reservation_time": string,"restaurant_id": string,"seated_at": string | null,"special_occasion": string | null,"starts_at": string,"status": Database["public"]['Enums']["reservation_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allergies"?: string | null,"arrived_at"?: string | null,"booking_source_id"?: string | null,"booking_type_id"?: string | null,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"customer_name": string,"deposit_amount"?: number,"dietary_requirements"?: string | null,"duration_minutes": number,"email"?: string | null,"ends_at": string,"guest_notes"?: string | null,"id"?: string,"internal_notes"?: string | null,"is_walk_in"?: boolean,"language"?: string,"manage_token_hash"?: string | null,"no_show_at"?: string | null,"organization_id": string,"party_size": number,"payment_status"?: Database["public"]['Enums']["payment_status"],"phone"?: string | null,"policy_accepted_at"?: string | null,"reference": string,"reminder_sent_at"?: string | null,"reservation_date": string,"reservation_time": string,"restaurant_id": string,"seated_at"?: string | null,"special_occasion"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["reservation_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "allergies"?: string | null,"arrived_at"?: string | null,"booking_source_id"?: string | null,"booking_type_id"?: string | null,"cancellation_reason"?: string | null,"cancelled_at"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"customer_name"?: string,"deposit_amount"?: number,"dietary_requirements"?: string | null,"duration_minutes"?: number,"email"?: string | null,"ends_at"?: string,"guest_notes"?: string | null,"id"?: string,"internal_notes"?: string | null,"is_walk_in"?: boolean,"language"?: string,"manage_token_hash"?: string | null,"no_show_at"?: string | null,"organization_id"?: string,"party_size"?: number,"payment_status"?: Database["public"]['Enums']["payment_status"],"phone"?: string | null,"policy_accepted_at"?: string | null,"reference"?: string,"reminder_sent_at"?: string | null,"reservation_date"?: string,"reservation_time"?: string,"restaurant_id"?: string,"seated_at"?: string | null,"special_occasion"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["reservation_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reservations_booking_source_id_fkey"
      columns: ["booking_source_id"]
isOneToOne: false
      referencedRelation: "booking_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservations_booking_type_id_fkey"
      columns: ["booking_type_id"]
isOneToOne: false
      referencedRelation: "booking_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservations_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservations_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservations_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"restaurant_areas": {
                  Row: {
                    "canvas_height": number,"canvas_width": number,"created_at": string,"id": string,"is_active": boolean,"name": string,"restaurant_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "canvas_height"?: number,"canvas_width"?: number,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"restaurant_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "canvas_height"?: number,"canvas_width"?: number,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"restaurant_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "restaurant_areas_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"restaurant_user_access": {
                  Row: {
                    "created_at": string,"id": string,"restaurant_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"restaurant_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"restaurant_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "restaurant_user_access_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "restaurant_user_access_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"restaurants": {
                  Row: {
                    "accepts_online_bookings": boolean,"address": string | null,"brand_color": string | null,"created_at": string,"cuisine": string | null,"currency": string,"default_daily_capacity": number | null,"description": string | null,"email": string | null,"id": string,"is_active": boolean,"logo_path": string | null,"name": string,"organization_id": string,"phone": string | null,"slug": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepts_online_bookings"?: boolean,"address"?: string | null,"brand_color"?: string | null,"created_at"?: string,"cuisine"?: string | null,"currency"?: string,"default_daily_capacity"?: number | null,"description"?: string | null,"email"?: string | null,"id"?: string,"is_active"?: boolean,"logo_path"?: string | null,"name": string,"organization_id": string,"phone"?: string | null,"slug": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "accepts_online_bookings"?: boolean,"address"?: string | null,"brand_color"?: string | null,"created_at"?: string,"cuisine"?: string | null,"currency"?: string,"default_daily_capacity"?: number | null,"description"?: string | null,"email"?: string | null,"id"?: string,"is_active"?: boolean,"logo_path"?: string | null,"name"?: string,"organization_id"?: string,"phone"?: string | null,"slug"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "restaurants_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"table_combination_members": {
                  Row: {
                    "combination_id": string,"table_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "combination_id": string,"table_id": string
                  }
                  Update: {
                    "combination_id"?: string,"table_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "table_combination_members_combination_id_fkey"
      columns: ["combination_id"]
isOneToOne: false
      referencedRelation: "table_combinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "table_combination_members_table_id_fkey"
      columns: ["table_id"]
isOneToOne: false
      referencedRelation: "tables"
      referencedColumns: ["id"]
    }
                  ]
                },"table_combinations": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"max_capacity": number,"min_capacity": number,"name": string,"restaurant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"max_capacity": number,"min_capacity"?: number,"name": string,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"max_capacity"?: number,"min_capacity"?: number,"name"?: string,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "table_combinations_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"tables": {
                  Row: {
                    "area_id": string | null,"created_at": string,"height": number,"id": string,"is_active": boolean,"is_combinable": boolean,"is_online_bookable": boolean,"label": string,"max_capacity": number,"min_capacity": number,"pos_x": number,"pos_y": number,"restaurant_id": string,"rotation": number,"service_status": Database["public"]['Enums']["table_service_status"],"shape": Database["public"]['Enums']["table_shape"],"sort_order": number,"updated_at": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id"?: string | null,"created_at"?: string,"height"?: number,"id"?: string,"is_active"?: boolean,"is_combinable"?: boolean,"is_online_bookable"?: boolean,"label": string,"max_capacity": number,"min_capacity"?: number,"pos_x"?: number,"pos_y"?: number,"restaurant_id": string,"rotation"?: number,"service_status"?: Database["public"]['Enums']["table_service_status"],"shape"?: Database["public"]['Enums']["table_shape"],"sort_order"?: number,"updated_at"?: string,"width"?: number
                  }
                  Update: {
                    "area_id"?: string | null,"created_at"?: string,"height"?: number,"id"?: string,"is_active"?: boolean,"is_combinable"?: boolean,"is_online_bookable"?: boolean,"label"?: string,"max_capacity"?: number,"min_capacity"?: number,"pos_x"?: number,"pos_y"?: number,"restaurant_id"?: string,"rotation"?: number,"service_status"?: Database["public"]['Enums']["table_service_status"],"shape"?: Database["public"]['Enums']["table_shape"],"sort_order"?: number,"updated_at"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tables_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "restaurant_areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tables_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"id": string,"organization_id": string,"role": Database["public"]['Enums']["app_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"organization_id": string,"role": Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string | null,"id": string,"is_active": boolean,"phone": string | null,"preferred_language": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string | null,"id": string,"is_active"?: boolean,"phone"?: string | null,"preferred_language"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string | null,"id"?: string,"is_active"?: boolean,"phone"?: string | null,"preferred_language"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"waitlists": {
                  Row: {
                    "created_at": string,"created_by": string | null,"customer_id": string | null,"customer_name": string,"id": string,"joined_at": string,"left_at": string | null,"notes": string | null,"notified_at": string | null,"party_size": number,"phone": string | null,"queue_date": string,"queue_number": number,"quoted_wait_minutes": number | null,"reservation_id": string | null,"restaurant_id": string,"seated_at": string | null,"status": Database["public"]['Enums']["waitlist_status"],"table_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"customer_name": string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"notes"?: string | null,"notified_at"?: string | null,"party_size": number,"phone"?: string | null,"queue_date": string,"queue_number": number,"quoted_wait_minutes"?: number | null,"reservation_id"?: string | null,"restaurant_id": string,"seated_at"?: string | null,"status"?: Database["public"]['Enums']["waitlist_status"],"table_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"customer_name"?: string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"notes"?: string | null,"notified_at"?: string | null,"party_size"?: number,"phone"?: string | null,"queue_date"?: string,"queue_number"?: number,"quoted_wait_minutes"?: number | null,"reservation_id"?: string | null,"restaurant_id"?: string,"seated_at"?: string | null,"status"?: Database["public"]['Enums']["waitlist_status"],"table_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "waitlists_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "waitlists_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "waitlists_reservation_id_fkey"
      columns: ["reservation_id"]
isOneToOne: false
      referencedRelation: "reservations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "waitlists_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "waitlists_table_id_fkey"
      columns: ["table_id"]
isOneToOne: false
      referencedRelation: "tables"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_deliveries": {
                  Row: {
                    "attempts": number,"created_at": string,"delivered_at": string | null,"endpoint_id": string,"error": string | null,"event": string,"id": string,"next_attempt_at": string | null,"payload": NonNullable<Json>,"response_status": number | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"delivered_at"?: string | null,"endpoint_id": string,"error"?: string | null,"event": string,"id"?: string,"next_attempt_at"?: string | null,"payload": NonNullable<Json>,"response_status"?: number | null,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"delivered_at"?: string | null,"endpoint_id"?: string,"error"?: string | null,"event"?: string,"id"?: string,"next_attempt_at"?: string | null,"payload"?: NonNullable<Json>,"response_status"?: number | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
      columns: ["endpoint_id"]
isOneToOne: false
      referencedRelation: "webhook_endpoints"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_endpoints": {
                  Row: {
                    "created_at": string,"created_by": string | null,"events": (string)[],"id": string,"is_active": boolean,"organization_id": string,"restaurant_id": string | null,"secret_hash": string,"updated_at": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"events"?: (string)[],"id"?: string,"is_active"?: boolean,"organization_id": string,"restaurant_id"?: string | null,"secret_hash": string,"updated_at"?: string,"url": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"events"?: (string)[],"id"?: string,"is_active"?: boolean,"organization_id"?: string,"restaurant_id"?: string | null,"secret_hash"?: string,"updated_at"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhook_endpoints_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "webhook_endpoints_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "webhook_endpoints_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "anonymize_customer":
{ Args: { "p_customer_id": string,"p_request_note"?: string }; Returns: undefined
                           },
"apply_retention":
{ Args: { "p_dry_run"?: boolean,"p_months": number }; Returns: Json
                           },
"assign_reservation_tables":
{ Args: { "p_allow_over_capacity"?: boolean,"p_reservation_id": string,"p_table_ids": (string)[] }; Returns: undefined
                           },
"create_reservation":
{ Args: { "payload": Json }; Returns: {
              "allergies": string | null,
"arrived_at": string | null,
"booking_source_id": string | null,
"booking_type_id": string | null,
"cancellation_reason": string | null,
"cancelled_at": string | null,
"completed_at": string | null,
"confirmed_at": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"customer_name": string,
"deposit_amount": number,
"dietary_requirements": string | null,
"duration_minutes": number,
"email": string | null,
"ends_at": string,
"guest_notes": string | null,
"id": string,
"internal_notes": string | null,
"is_walk_in": boolean,
"language": string,
"manage_token_hash": string | null,
"no_show_at": string | null,
"organization_id": string,
"party_size": number,
"payment_status": Database["public"]['Enums']["payment_status"],
"phone": string | null,
"policy_accepted_at": string | null,
"reference": string,
"reminder_sent_at": string | null,
"reservation_date": string,
"reservation_time": string,
"restaurant_id": string,
"seated_at": string | null,
"special_occasion": string | null,
"starts_at": string,
"status": Database["public"]['Enums']["reservation_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "reservations"
        isOneToOne: true
        isSetofReturn: false
      } },
"find_duplicate_customers":
{ Args: { "p_limit"?: number }; Returns: {
              "customer_a": string,"customer_b": string,"name_a": string,"name_b": string,"phone_a": string,"phone_b": string,"reason": string
            }[]
                           },
"hit_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"merge_customers":
{ Args: { "p_duplicate": string,"p_primary": string }; Returns: undefined
                           },
"my_restaurant_roles":
{ Args: Record<PropertyKey, never>; Returns: {
              "restaurant_id": string,"role": Database["public"]['Enums']["app_role"]
            }[]
                           },
"normalize_phone":
{ Args: { "p": string }; Returns: string
                           },
"set_table_service_status":
{ Args: { "p_status": Database["public"]['Enums']["table_service_status"],"p_table_id": string }; Returns: undefined
                           },
"table_occupancy":
{ Args: { "p_from": string,"p_restaurant_id": string,"p_to": string }; Returns: {
              "ends": string,"reservation_id": string,"starts": string,"table_id": string
            }[]
                           },
"table_occupancy_now":
{ Args: { "p_at": string,"p_restaurant_ids": (string)[] }; Returns: {
              "reservation_id": string,"table_id": string
            }[]
                           }
          }
          Enums: {
            "app_role": "super_admin"|"group_manager"|"restaurant_manager"|"host"|"viewer"|"call_center","deposit_type": "none"|"per_person"|"flat"|"full_prepayment","dsr_status": "open"|"in_progress"|"completed"|"rejected","dsr_type": "export"|"deletion"|"rectification","integration_status": "not_configured"|"pending"|"active"|"error"|"disabled","notification_channel": "email"|"sms"|"line"|"whatsapp","notification_event": "booking_confirmation"|"booking_reminder"|"booking_modification"|"booking_cancellation"|"waitlist_ready"|"birthday_campaign","notification_status": "queued"|"sending"|"sent"|"failed"|"not_configured"|"skipped","payment_kind": "deposit"|"prepayment"|"no_show_fee"|"cancellation_fee"|"other","payment_status": "not_required"|"pending"|"paid"|"partially_refunded"|"refunded"|"failed"|"waived","payment_txn_status": "pending"|"succeeded"|"failed"|"cancelled","refund_status": "pending"|"succeeded"|"failed","reservation_status": "pending"|"confirmed"|"arrived"|"seated"|"completed"|"cancelled"|"no_show","table_service_status": "available"|"cleaning"|"out_of_service","table_shape": "rect"|"round"|"square"|"bar","waitlist_status": "waiting"|"notified"|"seated"|"left"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["super_admin", "group_manager", "restaurant_manager", "host", "viewer", "call_center"],"deposit_type": ["none", "per_person", "flat", "full_prepayment"],"dsr_status": ["open", "in_progress", "completed", "rejected"],"dsr_type": ["export", "deletion", "rectification"],"integration_status": ["not_configured", "pending", "active", "error", "disabled"],"notification_channel": ["email", "sms", "line", "whatsapp"],"notification_event": ["booking_confirmation", "booking_reminder", "booking_modification", "booking_cancellation", "waitlist_ready", "birthday_campaign"],"notification_status": ["queued", "sending", "sent", "failed", "not_configured", "skipped"],"payment_kind": ["deposit", "prepayment", "no_show_fee", "cancellation_fee", "other"],"payment_status": ["not_required", "pending", "paid", "partially_refunded", "refunded", "failed", "waived"],"payment_txn_status": ["pending", "succeeded", "failed", "cancelled"],"refund_status": ["pending", "succeeded", "failed"],"reservation_status": ["pending", "confirmed", "arrived", "seated", "completed", "cancelled", "no_show"],"table_service_status": ["available", "cleaning", "out_of_service"],"table_shape": ["rect", "round", "square", "bar"],"waitlist_status": ["waiting", "notified", "seated", "left", "cancelled"]
          }
        }
} as const
