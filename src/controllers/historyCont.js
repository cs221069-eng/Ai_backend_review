import History from "../models/history.js";

export const getHistoryList = async (req, res) => {
  try {
    const history = await History.find({
      userId: req.user._id,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(history);
  } catch (error) {
    console.error("HISTORY LIST ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch history" });
  }
};

export const getHistoryById = async (req, res) => {
  try {
    const item = await History.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isDeleted: false,
    }).lean();

    if (!item) {
      return res.status(404).json({ message: "History not found" });
    }

    return res.status(200).json(item);
  } catch (error) {
    console.error("HISTORY DETAIL ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch history item" });
  }
};
