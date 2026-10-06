import { useContext, useEffect } from "react";
import { FollowedPeopleContext, type FollowedPeopleContextType } from "../context/FollowedPeopleContext";

/** Reads the shared followed-people state from `FollowedPeopleProvider`, fetching it on first use. */
export function useFollowedPeople(): FollowedPeopleContextType {
  const ctx = useContext(FollowedPeopleContext);
  if (ctx === null) throw new Error("useFollowedPeople must be used within FollowedPeopleProvider");
  const { request } = ctx;
  useEffect(() => { request(); }, [request]);
  return ctx;
}
