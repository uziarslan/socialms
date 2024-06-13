const express = require("express");
const axios = require("axios");
const natural = require("natural");
const Sentiment = require("sentiment");
const router = express.Router();
const fs = require("fs");
const NGrams = natural;
const wrapAsync = require("../utils/wrapAsync");
const Msdata = require("../read-csv");
const csv = require("csv-parser"); // Import the csv-parser library
const csvFilePath = "./extras/mypersonality_final.csv";
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: "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", // This is also the default, can be omitted
});

async function generatePersonalityDescription(personalityScores) {
  // Construct the prompt
  const prompt = `Generate a personality description based on the following scores:
  Extroversion: ${personalityScores.extroversion},
  Neuroticism: ${personalityScores.neuroticism},
  Agreeableness: ${personalityScores.agreeableness},
  Conscientiousness: ${personalityScores.conscientiousness},
  Openness: ${personalityScores.openness} 
  Also make a prediction about the person what he is into the most.`;

  try {
    // Make an API request to ChatGPT

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    if (chatCompletion.choices && chatCompletion.choices[0]) {
      return chatCompletion.choices[0].message;
    } else {
      console.error("Unexpected API response:", chatCompletion);
      return "An error occurred while generating the description.";
    }
  } catch (error) {
    console.error("Error generating personality description:", error);
    return "An error occurred while generating the description.";
  }
}
async function generateUserDataDescription(userData) {
  // Construct the prompt
  const prompt = `Generate a description based on the user data that will tell us what the user does, Also don't give the facebook account link in your response. Don't mention anything about facebook account link:
  User Data: ${JSON.stringify(userData)}`; // Convert userData to a JSON string

  try {
    // Make an API request to ChatGPT
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    if (chatCompletion.choices && chatCompletion.choices[0]) {
      return chatCompletion.choices[0].message;
    } else {
      console.error("Unexpected API response:", chatCompletion);
      return "An error occurred while generating the description.";
    }
  } catch (error) {
    console.error("Error generating user description:", error);
    return "An error occurred while generating the description.";
  }
}
// Function to load and preprocess CSV data
function loadAndPreprocessCSVData() {
  return new Promise((resolve, reject) => {
    const csvData = []; // Array to store CSV data

    // Read the CSV file and parse it
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (row) => {
        csvData.push(row);
      })
      .on("end", () => {
        // Resolve the promise with the loaded and preprocessed CSV data
        resolve(csvData);
      })
      .on("error", (error) => {
        // Reject the promise if there's an error
        reject(error);
      });
  });
}

const tokenizer = new natural.WordTokenizer();

function preprocessText(text) {
  text = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase();
  const tokens = tokenizer.tokenize(text);
  const stopwords = [
    "the",
    "da",
    "i",
    "s",
    "is",
    "and",
    "of",
    "in",
    "to",
    "a",
    "for",
    "on",
    "with",
    "as",
    "by",
    "an",
    "at",
  ];

  tokens.forEach((token) => {
    if (token.length < 4) {
      stopwords.push(token);
    }
  });

  const filteredTokens = tokens.filter((token) => !stopwords.includes(token));
  return filteredTokens;
}

function analyzeTextFrequency(textData, minOccurrences) {
  const wordFrequency = {};
  textData.forEach((word) => {
    wordFrequency[word] = (wordFrequency[word] || 0) + 1;
  });
  const sortedWordFrequency = Object.entries(wordFrequency).sort(
    (a, b) => b[1] - a[1]
  );
  const mostCommonWords = sortedWordFrequency
    .filter((entry) => entry[1] >= minOccurrences)
    .map((entry) => ({ word: entry[0], count: entry[1] }));

  return { mostCommonWords, wordFrequency };
}
function calculatePersonalityScores(text) {
  const tokens = preprocessText(text);
  const extroversionWords = [
    "outgoing",
    "social",
    "gregarious",
    "friendly",
    "bholay",
    "dostana",
  ];
  const neuroticismWords = [
    "anxious",
    "worried",
    "nervous",
    "fearful",
    "tangdil",
    "fikri",
  ];
  const agreeablenessWords = [
    "kind",
    "friendly",
    "compassionate",
    "helpful",
    "meharbani",
    "dostana",
  ];
  const conscientiousnessWords = [
    "organized",
    "responsible",
    "efficient",
    "dependable",
    "muntazim",
    "zimmedar",
  ];
  const opennessWords = [
    "creative",
    "curious",
    "imaginative",
    "open-minded",
    "tajruba-kar",
    "khulay dil wala",
  ];
  const extroversionScore = tokens.filter((token) =>
    extroversionWords.some((word) => token.includes(word))
  ).length;
  const neuroticismScore = tokens.filter((token) =>
    neuroticismWords.some((word) => token.includes(word))
  ).length;
  const agreeablenessScore = tokens.filter((token) =>
    agreeablenessWords.some((word) => token.includes(word))
  ).length;
  const conscientiousnessScore = tokens.filter((token) =>
    conscientiousnessWords.some((word) => token.includes(word))
  ).length;
  const opennessScore = tokens.filter((token) =>
    opennessWords.some((word) => token.includes(word))
  ).length;

  return {
    extroversion: extroversionScore,
    neuroticism: neuroticismScore,
    agreeableness: agreeablenessScore,
    conscientiousness: conscientiousnessScore,
    openness: opennessScore,
  };
}

router.get(
  "/",
  wrapAsync(async (req, res) => {
    // Fetch user data using the user access token
    const userDataResponse = await axios.get(
      "https://graph.facebook.com/v13.0/me",
      {
        params: {
          fields:
            "id,name,email,birthday,age_range,gender,hometown,link,likes,groups,picture,languages,favorite_teams,favorite_athletes,businesses,photos",
          access_token: req.session.userAccessToken,
        },
      }
    );
    const userData = userDataResponse.data;

    const fetchUserFeed = await axios.get(
      "https://graph.facebook.com/v13.0/me/feed",
      {
        params: {
          access_token: req.session.userAccessToken,
        },
      }
    );

    // Fetch albums and photos data
    const albumsResponse = await axios.get(
      "https://graph.facebook.com/v13.0/me?fields=albums{photos{images}}",
      {
        params: {
          access_token: req.session.userAccessToken,
        },
      }
    );
    const albumsData = albumsResponse.data.albums.data;

    const feedData = fetchUserFeed.data;

    const likedPagesData = userData.likes.data;
    // const likedGroupsData = userData.groups.data;

    const tokenizer = new natural.WordTokenizer();
    const stopwords = [
      "the",
      "da",
      "i",
      "s",
      "is",
      "and",
      "of",
      "in",
      "to",
      "a",
      "for",
      "on",
      "with",
      "as",
      "by",
      "an",
      "at",
    ];
    const pageWords = [];
    const groupWords = [];

    likedPagesData.forEach((page) => {
      const text = (page.name + " " + page.description).toLowerCase();
      const tokens = tokenizer.tokenize(text);
      const filteredTokens = tokens.filter(
        (token) => !stopwords.includes(token)
      );
      pageWords.push(...filteredTokens);
    });

    // likedGroupsData.forEach((group) => {
    //   const text = (group.name + " " + group.description).toLowerCase();
    //   const tokens = tokenizer.tokenize(text);
    //   const filteredTokens = tokens.filter(
    //     (token) => !stopwords.includes(token)
    //   );
    //   groupWords.push(...filteredTokens);
    // });

    const TfIdf = natural.TfIdf;
    const tfidf = new TfIdf();

    pageWords.forEach((word) => {
      tfidf.addDocument(pageWords);
    });

    groupWords.forEach((word) => {
      tfidf.addDocument(groupWords);
    });

    const interests = [];
    const interestsFromGroups = [];

    tfidf.listTerms(0).forEach((item) => {
      if (item.tfidf > 0.1) {
        interests.push(item.term);
      }
    });

    tfidf.listTerms(0).forEach((item) => {
      if (item.tfidf > 4) {
        interestsFromGroups.push(item.term);
      }
    });

    const groupinterest = interestsFromGroups[2];
    const topInterest = interests[1];

    const favoriteAthletesData = userData.favorite_athletes?.data || [];
    const favoriteTeamsData = userData.favorite_teams?.data || [];

    const athleteWords = [];
    const teamWords = [];

    favoriteAthletesData.forEach((athlete) => {
      const text = athlete.name.toLowerCase();
      const tokens = tokenizer.tokenize(text);
      const filteredTokens = tokens.filter(
        (token) => !stopwords.includes(token)
      );
      athleteWords.push(...filteredTokens);
    });

    favoriteTeamsData.forEach((team) => {
      const text = team.name.toLowerCase();
      const tokens = tokenizer.tokenize(text);
      const filteredTokens = tokens.filter(
        (token) => !stopwords.includes(token)
      );
      teamWords.push(...filteredTokens);
    });

    const athleteTfidf = new TfIdf();
    athleteWords.forEach((word) => {
      athleteTfidf.addDocument(athleteWords);
    });

    const teamTfidf = new TfIdf();
    teamWords.forEach((word) => {
      teamTfidf.addDocument(teamWords);
    });

    const athleteInterests = [];
    const teamInterests = [];

    athleteTfidf.listTerms(0).forEach((item) => {
      if (item.tfidf > 0.1) {
        athleteInterests.push(item.term);
      }
    });

    teamTfidf.listTerms(0).forEach((item) => {
      if (item.tfidf > 0.1) {
        teamInterests.push(item.term);
      }
    });

    const topAthleteInterest = athleteInterests[0];
    const topTeamInterest = teamInterests[0];

    // Analyze the user's feed data as before
    const feedText = feedData.data.map((item) => item.message).join(" ");
    const tokens = preprocessText(feedText);
    const minOccurrences = 2;
    const { mostCommonWords, wordFrequency } = analyzeTextFrequency(
      tokens,
      minOccurrences
    );

    const sentiment = new Sentiment();
    const sentimentResult = sentiment.analyze(feedText);

    const personalityScores = calculatePersonalityScores(feedText);
    let csvData;
    try {
      csvData = await loadAndPreprocessCSVData();
    } catch (error) {
      console.error("Error loading CSV data:", error);
      return res.status(500).send("Internal server error");
    }
    const userParams = {
      extroversion: personalityScores.extroversion,
      neuroticism: personalityScores.neuroticism,
      agreeableness: personalityScores.agreeableness,
      conscientiousness: personalityScores.conscientiousness,
      openness: personalityScores.openness,
      text: feedData,
    };

    const pD = await generatePersonalityDescription(userParams);
    const uD = await generateUserDataDescription(userData);

    res.render("./index", {
      userData,
      feedData,
      mostCommonWords,
      wordFrequency,
      sentiment: sentimentResult,
      interest: topInterest,
      interestsFromGroups: groupinterest,
      albumsData,
      topAthleteInterest,
      topTeamInterest,
      languages: userData.languages,
      personalityScores,
      pD,
      uD,
    });
  })
);

router.get(
  "/home",
  wrapAsync(async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("Code not provided");
    }
    const appId = process.env.APP_ID;
    const appSecret = process.env.APP_SECRET;
    const redirectURI = "http://localhost:3001/home";

    const response = await axios.get(
      `https://graph.facebook.com/v6.0/oauth/access_token`,
      {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectURI,
          code: code,
        },
      }
    );

    if (response.data.access_token) {
      const userAccessToken = response.data.access_token;
      req.session.userAccessToken = userAccessToken;
      return res.redirect("/");
    } else {
      res.status(400).send("Failed to obtain user access token");
    }
  })
);

module.exports = router;
