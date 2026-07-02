import mongoose from "mongoose";


const questionSchema = new mongoose.Schema({
    question : String,
    difficulties : String,
    timeLimit : Number,
    answer : String,
    feedback : String,
    score : {type: Number, default: 0},
     confidence : {type: String, default: 0},
     communication:{type: Number, default: 0},
     correctness: {type:Number, default: 0}
})

const interviewSchema = new mongoose.Schema(
  {
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    experience: {
      type: String,
      required: true,
    },
    mode: {
      type: String,
      enum: ["HR", "Technical"],
      required: true,
    },
    resumeText: {
        type: String,
    },
    questions:[questionSchema],

    finalScore: {type: Number, default: 0},
    status: {
        type: String,
        enum: ['Incompleted', "completed"],
        default: 'Incompleted'
    }

  },

  {
    timestamps: true,
  },
);


const Interview = mongoose.model("Interview",interviewSchema)

export default Interview
