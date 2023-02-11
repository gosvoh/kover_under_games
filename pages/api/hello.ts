// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { cache } from "react";

type Data = {
  name: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const response = await fetch("https://api.nexusmods.com/v1/users/validate", {
    next: { revalidate: 60 * 60 * 24 },
    headers: {
      apikey: process.env.NEXUSMODS_KEY as string,
    },
  });
  res.status(200).json(await response.json());
}

export const getGames = cache(async () => {
  const response = await fetch(
    "https://api.nexusmods.com/v1/users/validate.json",
    {
      next: { revalidate: 60 * 60 * 24 },
      headers: {
        apikey: process.env.NEXUSMODS_KEY as string,
      },
    }
  );
  return await response.json();
});
