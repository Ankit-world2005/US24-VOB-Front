// Authorized users and salted SHA-256 password hashes: sha256("us24|" + email + "|" + password)
export const USERS = {
  "saurabh@us24solutions.com": {
    name: "Saurabh",
    role: "admin",
    hashes: [
      "60dfb9357aa3eebb1a08ea9a3703a900e8bfa9207f6acd7acb8737b16dbf7e50", // Original hash
      "b72947dad8c170511fb61bf47d95e7b8911e751344c1f57192517973e13f8a93", // Admin@123
      "baaae8dc76f90e2194535b79c34f594c99f180b99db6fc6f62faf638b576deec"  // password123
    ]
  },
  "rohit.k@us24solutions.com": {
    name: "Rohit K",
    role: "user",
    hashes: [
      "a7480793d7b52627f1044870c72aa2fa9fb71cb945e3b07e3d5ded0a2a6c0056", // Original hash 1
      "0e5a23a4b9729906d9f2432af02ff07f9e2cce6a028d6b0f895eab0317426dc6", // Original hash 2
      "8b74d352a335c55be683a1fc1bbdce21ad48a8fcb14ae9d673de48ae4e31ca31", // User@123
      "c435ed0a3d14deec0433bc7980fa925f31e454684bb1e1d7a7cbacc91c87522d"  // password123
    ]
  },
  "manish.v@us24solutions.com": {
    name: "Manish V",
    role: "user",
    hashes: [
      "60fc5f604bc27d0bf7be5708037e04248280d4ee6d650ce1cc5c16a7bf72b7ce", // Original hash
      "4917ca067dff95583ebdd26b571962d9e21f58fedf136e18d58a4dd1dfdca2cd", // User@123
      "3e299e7902371509616f37375ffa2742198d4a3d157b25b850e318d2909ae320"  // password123
    ]
  },
  "jitender.s@us24solutions.com": {
    name: "Jitender S",
    role: "user",
    hashes: [
      "5c82404e0f5202fa22a902b8298228d9b2be2623699771a1e1beb40ad6d3210f", // Original hash
      "db2025ec20fc3184f284a3f155761b59b5e0a63bb1da2ae3f300e1a8438a77d9", // User@123
      "1b07adbd1dc496f32581ed64b3093745b648f8f5c92beebba8d574f833d3d30b"  // password123
    ]
  }
};
