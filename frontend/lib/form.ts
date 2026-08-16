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
 *   <form onSubmit={submitting(save)}>
 *
 * Forms that should clear on success do it by unmounting — every dialog here
 * closes, and the next open builds a fresh form from its defaults.
 *
 * The cost is that these forms no longer work without JavaScript. All of them
 * are already client components driven by `useTransition` or `useActionState`,
 * so there was no no-JS path to lose.
 */
export function submitting(handler: (data: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handler(new FormData(event.currentTarget));
  };
}
