"use client";

import { browserAuth } from "@/auth/browser";
import { safeAuthDestination } from "@/auth/redirect";
import { PRODUCT } from "@/config/product";
import {
  Box,
  Button,
  Container,
  Field,
  Heading,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(
    searchParams.get("error")
      ? "Sign-in was canceled or could not be completed."
      : null,
  );
  const [isRequestSubmitting, setIsRequestSubmitting] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestErrors, setRequestErrors] = useState<{
    name: string;
    email: string;
  }>({
    name: "",
    email: "",
  });
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setIsSigningIn(true);
    setAuthMessage(null);

    const next = safeAuthDestination(searchParams.get("next"));
    const callback = new URL("/auth/confirm", window.location.origin);
    callback.searchParams.set("next", next);

    try {
      await browserAuth.startSocialSignIn("google", callback.toString());
    } catch {
      setAuthMessage("Google sign-in could not be started. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleRequestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = requestName.trim();
    const trimmedEmail = requestEmail.trim();
    const nextErrors = {
      name: "",
      email: "",
    };

    if (!trimmedName) {
      nextErrors.name = "Name cannot be empty.";
    } else if (trimmedName.length > 100) {
      nextErrors.name = "Name must be 100 characters or fewer.";
    }

    if (!trimmedEmail) {
      nextErrors.email = "Email cannot be empty.";
    } else if (!EMAIL_RE.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    const hasErrors = Object.values(nextErrors).some(Boolean);
    setRequestErrors(nextErrors);
    setRequestMessage(null);

    if (hasErrors) return;

    setIsRequestSubmitting(true);
    try {
      const response = await fetch("/api/request-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage =
          (payload && typeof payload.error === "string" && payload.error) ??
          "Could not submit request access.";
        setRequestMessage(errorMessage);
        return;
      }

      setRequestMessage(
        "Request sent. You should receive an email of confirmation shortly.",
      );
      setRequestName("");
      setRequestEmail("");
      setRequestErrors({ name: "", email: "" });
    } catch {
      setRequestMessage("Could not submit request access. Please try again.");
    } finally {
      setIsRequestSubmitting(false);
    }
  }

  const canSubmitRequest =
    requestName.trim().length > 0 && requestEmail.trim().length > 0;

  return (
    <Box
      as="main"
      layerStyle="page"
      minH="100vh"
      display="grid"
      placeItems="center"
    >
      <Container maxW="md" px="6" py="12">
        <Stack gap="7">
          <Box>
            <Heading as="h1" textStyle="pageTitle">
              {PRODUCT.name}
            </Heading>
            <Text color="text.secondary" mt="2">
              See Tomorrow. Shape it Today.
            </Text>
          </Box>

          <Box layerStyle="panel">
            <Stack gap="6">
              <Button
                type="button"
                bgColor="red.600"
                _hover={{ bgColor: "red.500" }}
                color={"colorPalette.200"}
                loading={isSigningIn}
                onClick={handleGoogleSignIn}
              >
                Continue with Google
              </Button>

              <Box
                as="div"
                role="separator"
                aria-hidden="true"
                borderBottom="1px solid"
                borderColor="border.subtle"
                w="full"
                h={0.5}
                bgColor={"gray.200"}
                opacity={0.6}
                my="2"
              />

              <Text>
                Only invited members can login. Request access below to enter
                the waitlist.
              </Text>

              <form onSubmit={handleRequestAccess}>
                <Stack gap="4">
                  <Field.Root required invalid={Boolean(requestErrors.name)}>
                    <Field.Label>Full name</Field.Label>
                    <Input
                      value={requestName}
                      maxLength={100}
                      onChange={(event) => {
                        setRequestName(event.currentTarget.value);
                        if (requestErrors.name) {
                          setRequestErrors((current) => ({
                            ...current,
                            name: "",
                          }));
                        }
                      }}
                      onBlur={() => {
                        const trimmedName = requestName.trim();
                        if (!trimmedName) {
                          setRequestErrors((current) => ({
                            ...current,
                            name: "Name cannot be empty.",
                          }));
                        } else if (trimmedName.length > 100) {
                          setRequestErrors((current) => ({
                            ...current,
                            name: "Name must be 100 characters or fewer.",
                          }));
                        } else {
                          setRequestErrors((current) => ({
                            ...current,
                            name: "",
                          }));
                        }
                      }}
                    />
                    <Field.ErrorText>{requestErrors.name}</Field.ErrorText>
                  </Field.Root>

                  <Field.Root required invalid={Boolean(requestErrors.email)}>
                    <Field.Label>Email</Field.Label>
                    <Input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={requestEmail}
                      onChange={(event) => {
                        setRequestEmail(event.currentTarget.value);
                        if (requestErrors.email) {
                          setRequestErrors((current) => ({
                            ...current,
                            email: "",
                          }));
                        }
                      }}
                      onBlur={() => {
                        const trimmedEmail = requestEmail.trim();
                        if (!trimmedEmail) {
                          setRequestErrors((current) => ({
                            ...current,
                            email: "Email cannot be empty.",
                          }));
                        } else if (!EMAIL_RE.test(trimmedEmail)) {
                          setRequestErrors((current) => ({
                            ...current,
                            email: "Please enter a valid email address.",
                          }));
                        } else {
                          setRequestErrors((current) => ({
                            ...current,
                            email: "",
                          }));
                        }
                      }}
                    />
                    <Field.ErrorText>{requestErrors.email}</Field.ErrorText>
                  </Field.Root>

                  <Button
                    type="submit"
                    color="colorPalette.200"
                    loading={isRequestSubmitting}
                    disabled={isRequestSubmitting || !canSubmitRequest}
                  >
                    Request access
                  </Button>
                  {requestMessage && (
                    <Text color="text.secondary" role="status">
                      {requestMessage}
                    </Text>
                  )}
                </Stack>
              </form>
              {authMessage && (
                <Text color="text.secondary" role="status">
                  {authMessage}
                </Text>
              )}
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
