// Canonical concrete Reaction Lab chemistry authority used by both production and tests.
// This file was migrated mechanically from the frozen ⑦A fixture projection.
export const REACTION_CATALOG = Object.freeze([
  {
    "id": "complete-01-anhydride-hydrolysis",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "acetic-anhydride"
      },
      {
        "role": "transferPair",
        "species": "water"
      }
    ],
    "products": [
      "acetic-acid",
      "acetic-acid"
    ],
    "requires": [],
    "forbids": [
      "basic"
    ]
  },
  {
    "id": "complete-02-anhydride-alcoholysis",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "acetic-anhydride"
      },
      {
        "role": "transferPair",
        "species": "ethanol"
      }
    ],
    "products": [
      "ethyl-acetate",
      "acetic-acid"
    ],
    "requires": [],
    "forbids": [
      "basic"
    ]
  },
  {
    "id": "complete-03-aspirin-synthesis",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "acetic-anhydride"
      },
      {
        "role": "transferPair",
        "species": "salicylic-acid"
      }
    ],
    "products": [
      "aspirin",
      "acetic-acid"
    ],
    "requires": [
      "acidic",
      "heat"
    ],
    "forbids": []
  },
  {
    "id": "complete-04-aspirin-hydrolysis",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "aspirin"
      },
      {
        "role": "transferPair",
        "species": "water"
      }
    ],
    "products": [
      "salicylic-acid",
      "acetic-acid"
    ],
    "requires": [
      "acidic",
      "heat"
    ],
    "forbids": []
  },
  {
    "id": "complete-05-amide-alcoholysis",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "ethyl-acetate"
      },
      {
        "role": "transferPair",
        "species": "ammonia"
      }
    ],
    "products": [
      "acetamide",
      "ethanol"
    ],
    "requires": [],
    "forbids": [
      "acidic",
      "basic"
    ]
  },
  {
    "id": "complete-06-ethene-halogenation",
    "familyId": "pi-pair-addition",
    "reactants": [
      {
        "role": "substrate",
        "species": "ethene"
      },
      {
        "role": "transferPair",
        "species": "chlorine"
      }
    ],
    "products": [
      "1-2-dichloroethane"
    ],
    "requires": [],
    "forbids": [
      "basic"
    ]
  },
  {
    "id": "complete-07-sulfur-trioxide-hydration",
    "familyId": "pi-pair-addition",
    "reactants": [
      {
        "role": "substrate",
        "species": "sulfur-trioxide"
      },
      {
        "role": "transferPair",
        "species": "water"
      }
    ],
    "products": [
      "sulfuric-acid"
    ],
    "requires": [],
    "forbids": [
      "basic"
    ]
  },
  {
    "id": "complete-08-phosphorus-pentachloride-formation",
    "familyId": "pair-addition-to-center",
    "reactants": [
      {
        "role": "center",
        "species": "phosphorus-trichloride"
      },
      {
        "role": "pair",
        "species": "chlorine"
      }
    ],
    "products": [
      "phosphorus-pentachloride"
    ],
    "requires": [],
    "forbids": [
      "heat",
      "basic"
    ]
  },
  {
    "id": "complete-09-ethylene-oxide-acid-cleavage",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "ethylene-oxide"
      },
      {
        "role": "transferPair",
        "species": "water"
      }
    ],
    "products": [
      "ethylene-glycol"
    ],
    "requires": [
      "acidic"
    ],
    "forbids": []
  },
  {
    "id": "complete-10-ethylene-oxide-basic-cleavage",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "ethylene-oxide"
      },
      {
        "role": "transferPair",
        "species": "water"
      }
    ],
    "products": [
      "ethylene-glycol"
    ],
    "requires": [
      "basic",
      "heat"
    ],
    "forbids": []
  },
  {
    "id": "complete-11-propene-hydration",
    "familyId": "pi-pair-addition",
    "reactants": [
      {
        "role": "substrate",
        "species": "propene"
      },
      {
        "role": "transferPair",
        "species": "water"
      }
    ],
    "products": [
      "2-propanol"
    ],
    "requires": [
      "acidic"
    ],
    "forbids": [
      "heat"
    ]
  },
  {
    "id": "complete-12-1-butene-hydration",
    "familyId": "pi-pair-addition",
    "reactants": [
      {
        "role": "substrate",
        "species": "1-butene"
      },
      {
        "role": "transferPair",
        "species": "water"
      }
    ],
    "products": [
      "2-butanol"
    ],
    "requires": [
      "acidic"
    ],
    "forbids": [
      "heat"
    ]
  },
  {
    "id": "complete-13-2-butene-hydration",
    "familyId": "pi-pair-addition",
    "reactants": [
      {
        "role": "substrate",
        "species": "2-butene"
      },
      {
        "role": "transferPair",
        "species": "water"
      }
    ],
    "products": [
      "2-butanol"
    ],
    "requires": [
      "acidic"
    ],
    "forbids": [
      "heat"
    ]
  },
  {
    "id": "complete-14-isobutene-hydration",
    "familyId": "pi-pair-addition",
    "reactants": [
      {
        "role": "substrate",
        "species": "isobutene"
      },
      {
        "role": "transferPair",
        "species": "water"
      }
    ],
    "products": [
      "tert-butanol"
    ],
    "requires": [
      "acidic"
    ],
    "forbids": [
      "heat"
    ]
  },
  {
    "id": "complete-15-cyclohexene-hydration",
    "familyId": "pi-pair-addition",
    "reactants": [
      {
        "role": "substrate",
        "species": "cyclohexene"
      },
      {
        "role": "transferPair",
        "species": "water"
      }
    ],
    "products": [
      "cyclohexanol"
    ],
    "requires": [
      "acidic"
    ],
    "forbids": [
      "heat"
    ]
  },
  {
    "id": "complete-16-methane-chlorination",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "methane"
      },
      {
        "role": "transferPair",
        "species": "chlorine"
      }
    ],
    "products": [
      "chloromethane",
      "hydrogen-chloride"
    ],
    "requires": [
      "light"
    ],
    "forbids": [
      "basic"
    ]
  },
  {
    "id": "complete-17-chloromethane-chlorination",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "chloromethane"
      },
      {
        "role": "transferPair",
        "species": "chlorine"
      }
    ],
    "products": [
      "dichloromethane",
      "hydrogen-chloride"
    ],
    "requires": [
      "light"
    ],
    "forbids": [
      "basic"
    ]
  },
  {
    "id": "complete-18-dichloromethane-chlorination",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "dichloromethane"
      },
      {
        "role": "transferPair",
        "species": "chlorine"
      }
    ],
    "products": [
      "chloroform",
      "hydrogen-chloride"
    ],
    "requires": [
      "light"
    ],
    "forbids": [
      "basic"
    ]
  },
  {
    "id": "complete-19-chloroform-chlorination",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "chloroform"
      },
      {
        "role": "transferPair",
        "species": "chlorine"
      }
    ],
    "products": [
      "carbon-tetrachloride",
      "hydrogen-chloride"
    ],
    "requires": [
      "light"
    ],
    "forbids": [
      "basic"
    ]
  },
  {
    "id": "complete-20-hydrogen-chlorination",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "hydrogen"
      },
      {
        "role": "transferPair",
        "species": "chlorine"
      }
    ],
    "products": [
      "hydrogen-chloride",
      "hydrogen-chloride"
    ],
    "requires": [
      "light"
    ],
    "forbids": [
      "basic"
    ]
  },
  {
    "id": "complete-21-cyclobutane-dimerization",
    "familyId": "double-pair-cycloaddition",
    "reactants": [
      {
        "role": "alkeneA",
        "species": "ethene"
      },
      {
        "role": "alkeneB",
        "species": "ethene"
      }
    ],
    "products": [
      "cyclobutane"
    ],
    "requires": [
      "light"
    ],
    "forbids": []
  },
  {
    "id": "complete-22-dimethyl-sulfide-oxidation",
    "familyId": "oxygen-atom-transfer",
    "reactants": [
      {
        "role": "sulfide",
        "species": "dimethyl-sulfide"
      },
      {
        "role": "peroxide",
        "species": "hydrogen-peroxide"
      }
    ],
    "products": [
      "dimethyl-sulfoxide",
      "water"
    ],
    "requires": [],
    "forbids": []
  },
  {
    "id": "complete-23-methanol-dehydration",
    "familyId": "sigma-cross-exchange",
    "reactants": [
      {
        "role": "primary",
        "species": "methanol"
      },
      {
        "role": "transferPair",
        "species": "methanol"
      }
    ],
    "products": [
      "dimethyl-ether",
      "water"
    ],
    "requires": [
      "acidic",
      "heat"
    ],
    "forbids": []
  },
  {
    "id": "complete-24-urea-hydrolysis",
    "familyId": "bis-leaving-hydrolysis",
    "reactants": [
      {
        "role": "urea",
        "species": "urea"
      },
      {
        "role": "water",
        "species": "water"
      }
    ],
    "products": [
      "ammonia",
      "ammonia",
      "carbon-dioxide"
    ],
    "requires": [
      "heat"
    ],
    "forbids": [
      "acidic",
      "basic"
    ]
  },
  {
    "id": "complete-25-carbonyl-sulfide-hydrolysis",
    "familyId": "heterocumulene-hydrolysis",
    "reactants": [
      {
        "role": "cos",
        "species": "carbonyl-sulfide"
      },
      {
        "role": "water",
        "species": "water"
      }
    ],
    "products": [
      "carbon-dioxide",
      "hydrogen-sulfide"
    ],
    "requires": [
      "heat"
    ],
    "forbids": [
      "basic"
    ]
  },
  {
    "id": "complete-26-hydrogen-combustion",
    "familyId": "hydrogen-combustion",
    "reactants": [
      {
        "role": "hydrogenA",
        "species": "hydrogen"
      },
      {
        "role": "oxygen",
        "species": "oxygen"
      },
      {
        "role": "hydrogenB",
        "species": "hydrogen"
      }
    ],
    "products": [
      "water",
      "water"
    ],
    "requires": [
      "heat"
    ],
    "forbids": []
  },
  {
    "id": "complete-27-carbon-monoxide-oxidation",
    "familyId": "triple-bond-diatomic-oxidation",
    "reactants": [
      {
        "role": "coA",
        "species": "carbon-monoxide"
      },
      {
        "role": "oxygen",
        "species": "oxygen"
      },
      {
        "role": "coB",
        "species": "carbon-monoxide"
      }
    ],
    "products": [
      "carbon-dioxide",
      "carbon-dioxide"
    ],
    "requires": [
      "heat"
    ],
    "forbids": []
  },
  {
    "id": "complete-28-methane-combustion",
    "familyId": "methane-combustion",
    "reactants": [
      {
        "role": "methane",
        "species": "methane"
      },
      {
        "role": "oxygenA",
        "species": "oxygen"
      },
      {
        "role": "oxygenB",
        "species": "oxygen"
      }
    ],
    "products": [
      "carbon-dioxide",
      "water",
      "water"
    ],
    "requires": [
      "heat"
    ],
    "forbids": []
  },
  {
    "id": "complete-29-difluoromethane-combustion",
    "familyId": "halomethane-combustion",
    "reactants": [
      {
        "role": "halomethane",
        "species": "difluoromethane"
      },
      {
        "role": "oxygen",
        "species": "oxygen"
      }
    ],
    "products": [
      "carbon-dioxide",
      "hydrogen-fluoride",
      "hydrogen-fluoride"
    ],
    "requires": [
      "heat"
    ],
    "forbids": []
  }
]);
