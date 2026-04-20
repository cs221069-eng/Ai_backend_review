import mongoose from 'mongoose'

const historySchema = new mongoose.Schema({

  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  code: { 
    type: String, 
    required: true 
  },

  language: { 
    type: String, 
    required: true 
  },

  score: { 
    type: Number, 
    required: true 
  },

  issues: [
    {
      title: String,
      severity: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "low"
      }
    }
  ],

  suggestions: [
    {
      title: String
    }
  ],

  aiResponse: { 
    type: String 
  },

  title: { 
    type: String, 
    default: "Untitled Review" 
  },

  isStarred: { 
    type: Boolean, 
    default: false 
  },

  isDeleted: { 
    type: Boolean, 
    default: false 
  }

}, { timestamps: true })

const History = mongoose.model('History', historySchema)

export default History