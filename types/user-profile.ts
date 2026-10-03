export type UserProfile = {
  uid: string;
  email: string;
  /** Defaults to the local part of the email (before @) until the user sets one. */
  displayName: string;
  photoUri?: string;
};
