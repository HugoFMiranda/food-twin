# Food Twin

Food Twin is a modern web application that helps users find nutritionally similar foods based on macronutrient profiles. Built with the T3 Stack, this application provides a powerful and intuitive interface for comparing foods and discovering alternatives.

![Food Twin](https://via.placeholder.com/800x400?text=Food+Twin+Screenshot)

## Features

- **Smart Food Search**: Quickly search for foods with real-time suggestions
- **Nutritional Similarity**: Find foods with similar macronutrient profiles using advanced similarity algorithms
- **Detailed Nutritional Information**: View comprehensive nutritional data including calories, protein, carbs, and fat
- **Filtering Options**: Refine results with filters for protein ratio, maximum calories, and vegan options
- **Visual Similarity Scores**: Color-coded similarity scores make it easy to identify the best matches
- **Portion Information**: View common portion sizes and weights for each food

## Technology Stack

Food Twin is built on the [T3 Stack](https://create.t3.gg/), a modern web development stack that includes:

- **[Next.js](https://nextjs.org)**: React framework for server-rendered applications
- **[TypeScript](https://www.typescriptlang.org/)**: Type-safe JavaScript for better developer experience
- **[Tailwind CSS](https://tailwindcss.com)**: Utility-first CSS framework for rapid UI development
- **[tRPC](https://trpc.io)**: End-to-end typesafe API layer
- **[Prisma](https://prisma.io)**: Next-generation ORM for database access
- **[SQLite](https://www.sqlite.org/)**: Lightweight database for storing food nutritional data

## Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/food-twin.git
   cd food-twin
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up the database:
   ```bash
   npx prisma db push
   ```

4. Import food data (optional):
   ```bash
   npm run import-foods
   ```

5. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Enter a food name in the search box
2. Select a food from the suggestions or press the Search button
3. View the nutritional information of your selected food
4. Explore similar foods ranked by nutritional similarity
5. Use filters to refine your search results

## Deployment

This application can be easily deployed to:

- [Vercel](https://vercel.com) (recommended for Next.js applications)
- [Netlify](https://netlify.com)
- [Docker](https://www.docker.com/)

For detailed deployment instructions, refer to the [T3 deployment guides](https://create.t3.gg/en/deployment/vercel).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Food data provided by [USDA FoodData Central](https://fdc.nal.usda.gov/)
- Built with the [T3 Stack](https://create.t3.gg/)
