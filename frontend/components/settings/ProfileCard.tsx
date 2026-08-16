"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Panel } from "@/components/dashboard/Panel";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { updateProfile, uploadAvatar, removeAvatar } from "@/app/dashboard/actions";
import { displayName, initialsOf, type Profile } from "@/lib/profile";

/**
 * Profile.
 *
 * The email is shown but not editable: changing it in Supabase sends a
 * confirmation to both the old and new address and is a flow of its own, not a
 * text field you can quietly overwrite.
 */
export function ProfileCard({ profile }: { profile: Profile }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();

  function save(form: FormData) {
    startTransition(async () => {
      const result = await updateProfile({}, form);
      setError(result.ok ? undefined : (result.error ?? "Could not save."));
      setSaved(!!result.ok);
    });
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set("avatar", file);
    startUpload(async () => {
      const result = await uploadAvatar({}, form);
      setPhotoError(result.ok ? undefined : (result.error ?? "Could not upload that."));
      // Let the same file be chosen again after a failure.
      if (fileInput.current) fileInput.current.value = "";
    });
  }

  function clearPhoto() {
    startUpload(async () => {
      const result = await removeAvatar();
      setPhotoError(result.ok ? undefined : (result.error ?? "Could not remove it."));
    });
  }

  return (
    <Panel title="Profile">
      <div className="mb-5 flex items-center gap-4">
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt={`${displayName(profile)}'s photo`}
            width={56}
            height={56}
            className="h-14 w-14 flex-none rounded-full object-cover"
            unoptimized
          />
        ) : (
          <span
            className="grid h-14 w-14 flex-none place-items-center rounded-full text-[17px] font-semibold"
            style={{ backgroundColor: "var(--surface-3)" }}
          >
            {initialsOf(profile)}
          </span>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="rounded-[10px] border px-3.5 py-2 text-[12.5px] transition-colors duration-200 hover:bg-[var(--surface-2)] disabled:opacity-60"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            {uploading ? "Working…" : profile.avatarUrl ? "Change photo" : "Upload photo"}
          </button>
          {profile.avatarUrl && (
            <button
              type="button"
              onClick={clearPhoto}
              disabled={uploading}
              className="text-[12.5px] underline-offset-4 hover:underline disabled:opacity-60"
              style={{ color: "var(--text-faint)" }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {photoError ? (
        <p className="mb-4 text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
          {photoError}
        </p>
      ) : (
        <p className="mb-4 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
          PNG, JPEG or WebP, up to 2 MB. Without one we use your initials.
        </p>
      )}

      <form action={save} className="flex flex-col gap-4">
        <Field label="Full name" name="full_name" defaultValue={profile.fullName ?? ""} required />
        <Field
          label="Email"
          type="email"
          defaultValue={profile.email}
          disabled
          hint="Changing your email needs confirmation from both addresses — not built yet."
        />
        <Field
          label="Phone"
          name="phone"
          defaultValue={profile.phone ?? ""}
          placeholder="+92 300 1234567"
          hint="Used for future SMS alerts only."
        />

        {error && (
          <p className="text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
          {saved && !pending && (
            <span className="text-[12.5px]" style={{ color: "var(--color-gain)" }}>
              Saved
            </span>
          )}
        </div>
      </form>
    </Panel>
  );
}
