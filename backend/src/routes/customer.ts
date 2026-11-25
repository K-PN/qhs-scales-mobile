import { Router } from "express";
import { dbFor } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { route } from "../utils/http.js";
const router = Router();
router.use(requireAuth);
router.get(
  "/profile",
  route(async (req, res) => {
    const [rows] = await dbFor(req.user!.source).execute(
      "SELECT id,name,address,phonenumber,startdate,enddate FROM tbusers_group WHERE id=?",
      [req.user!.stationId],
    );
    res.json({
      station: (rows as any[])[0] ?? null,
      scope: "station",
    });
  }),
);
export default router;
