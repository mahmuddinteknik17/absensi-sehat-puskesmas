export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      apel_schedule: {
        Row: {
          file_name: string
          id: number
          image_path: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          file_name: string
          id?: number
          image_path: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          file_name?: string
          id?: number
          image_path?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          akurasi: number | null
          created_at: string
          id: string
          jam: string
          jarak_meter: number | null
          keterangan: string | null
          latitude: number | null
          longitude: number | null
          perangkat: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          tanggal: string
          user_id: string
        }
        Insert: {
          akurasi?: number | null
          created_at?: string
          id?: string
          jam?: string
          jarak_meter?: number | null
          keterangan?: string | null
          latitude?: number | null
          longitude?: number | null
          perangkat?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          tanggal?: string
          user_id: string
        }
        Update: {
          akurasi?: number | null
          created_at?: string
          id?: string
          jam?: string
          jarak_meter?: number | null
          keterangan?: string | null
          latitude?: number | null
          longitude?: number | null
          perangkat?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          tanggal?: string
          user_id?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          id: string
          keterangan: string | null
          nama: string
          tanggal: string
        }
        Insert: {
          created_at?: string
          id?: string
          keterangan?: string | null
          nama: string
          tanggal: string
        }
        Update: {
          created_at?: string
          id?: string
          keterangan?: string | null
          nama?: string
          tanggal?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          created_at: string
          id: string
          jenis: string
          keterangan: string | null
          tanggal_mulai: string
          tanggal_selesai: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          jenis?: string
          keterangan?: string | null
          tanggal_mulai: string
          tanggal_selesai: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          jenis?: string
          keterangan?: string | null
          tanggal_mulai?: string
          tanggal_selesai?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          jabatan: string | null
          nama: string
          nip: string
          unit_kerja: string | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          jabatan?: string | null
          nama: string
          nip: string
          unit_kerja?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          jabatan?: string | null
          nama?: string
          nip?: string
          unit_kerja?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          alamat: string | null
          batas_terlambat: string
          id: number
          jam_buka: string
          jam_tutup: string
          nama_instansi: string
          office_lat: number
          office_lng: number
          radius_meter: number
          updated_at: string
        }
        Insert: {
          alamat?: string | null
          batas_terlambat?: string
          id?: number
          jam_buka?: string
          jam_tutup?: string
          nama_instansi?: string
          office_lat?: number
          office_lng?: number
          radius_meter?: number
          updated_at?: string
        }
        Update: {
          alamat?: string | null
          batas_terlambat?: string
          id?: number
          jam_buka?: string
          jam_tutup?: string
          nama_instansi?: string
          office_lat?: number
          office_lng?: number
          radius_meter?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "pegawai"
      attendance_status:
        | "hadir"
        | "terlambat"
        | "tidak_hadir"
        | "libur"
        | "izin"
        | "sakit"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "pegawai"],
      attendance_status: [
        "hadir",
        "terlambat",
        "tidak_hadir",
        "libur",
        "izin",
        "sakit",
      ],
    },
  },
} as const
