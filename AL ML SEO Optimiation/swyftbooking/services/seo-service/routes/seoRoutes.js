import express from "express";
import { getRouteSEO, listRoutes } from "../controllers/routeController.js";

const router = express.Router();

router.get("/routes", listRoutes);
router.get("/:slug", getRouteSEO);

export default router;

