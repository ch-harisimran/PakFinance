import { startTransition } from "react";

/**
 * Keep what the user typed when a submit comes back with an error.
 *
 * React resets an uncontrolled form as soon as a function passed to `action`
 * returns, and it does not distinguish success from failure. So a form that
 * reports "that password isn't right" hands back an empty password box, and an
 * edit dialog that rejects one field quietly reverts every other one to the
 * stored value — the opposite of what showing an error message is for.
 *
 * Taking the submit ourselves stops the automatic reset. Nothing else changes:
 * the handler still receives exactly the FormData the form would have sent.
 *
 *   <form method="post" onSubmit={submitting(save)}>
 *
 * THE `method="post"` IS REQUIRED. A submit that happens before React hydrates
 * finds no listener, so `preventDefault` never runs and the browser submits the
 * form itself — and a form with no method submits as GET, putting every field
 * in the URL. That is how a password ends up in an access log, the browser
 * history and a Referer header. `<form action={serverAction}>` never had this
 * problem because Next renders it as a real POST; taking the submit ourselves
 * is what makes the fallback ours to get right.
 *
 * Which is also why the auth pages do NOT use this helper: they carry passwords,
 * they are server-rendered and submittable before hydration, and their actions
 * already hand the typed email back through `useActionState` so nothing is lost
 * on a failed attempt anyway.
 *
 * Forms that should clear on success do it by unmounting — every dialog here
 * closes, and the next open builds a fresh form from its defaults.
 *
 * The cost is that these forms no longer work without JavaScript. All of them
 * are already client components driven by `useTransition` or `useActionState`,
 * so there was no no-JS path to lose.
 *
 * The `startTransition` is required, not defensive. Passing an action to a
 * `form` gets React's own transition for free; calling it ourselves does not,
 * and a `useActionState` dispatch invoked outside one never flips `isPending` —
 * so every auth form would keep saying "Sign in" while the request was in
 * flight. Handlers that open their own transition simply nest, which is fine.
 */
export function submitting(handler: (data: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Read the form BEFORE the transition: React nulls `currentTarget` once the
    // handler returns, and the callback must not reach for it later.
    const data = new FormData(event.currentTarget);
    startTransition(() => handler(data));
  };
}
