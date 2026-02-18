import Stripe from "stripe";
import { env } from "./env";

export const stripe = new Stripe(env.stripe.secretKey, {
  apiVersion: "2024-04-10",
  typescript: true,
});
