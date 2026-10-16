import { fetchMoviePoster, fetchTVPoster } from "../../api/tmdb";
import { lookupImportPosters } from "../importPosters";
import { resetPacer } from "../pacedLookup";

// data-backup: only rows the file doesn't give both a poster and a score are
// looked up, and the file's values beat the lookup's.

jest.mock("../../api/tmdb", () => ({ __esModule: true, fetchMoviePoster: jest.fn(), fetchTVPoster: jest.fn() }));
jest.setTimeout(15_000);

const movie = fetchMoviePoster as jest.Mock;
const tv = fetchTVPoster as jest.Mock;
const notFound = Object.assign(new Error("404"), { isAxiosError: true, response: { status: 404 } });

beforeEach(() => {
  resetPacer();
  movie.mockResolvedValue({ data: { poster_path: "/m.jpg", vote_average: 6 } });
  tv.mockResolvedValue({ data: { poster_path: "/t.jpg", vote_average: 7 } });
});

it("looks up nothing when every row has a poster and a score", async () => {
  const progress = jest.fn();
  const { found, missing } = await lookupImportPosters(
    [{ mediaId: 1, type: "movie", posterPath: "/a.jpg", voteAverage: 8 }, { mediaId: 2, type: "tv", posterPath: "/b.jpg", voteAverage: 0 }],
    progress,
  );
  expect(movie).not.toHaveBeenCalled();
  expect(tv).not.toHaveBeenCalled();
  expect(progress).not.toHaveBeenCalled();
  expect(found).toEqual([{ posterPath: "/a.jpg", voteAverage: 8 }, { posterPath: "/b.jpg", voteAverage: 0 }]);
  expect(missing).toBe(0);
});

it("looks up only partial rows and fills only what the file lacks", async () => {
  const { found } = await lookupImportPosters([
    { mediaId: 1, type: "movie", posterPath: "/a.jpg", voteAverage: 8 },
    { mediaId: 2, type: "movie", posterPath: "/b.jpg" },
    { mediaId: 3, type: "tv", voteAverage: 9 },
  ]);
  expect(movie.mock.calls.map((c) => c[0])).toEqual([2]);
  expect(tv.mock.calls.map((c) => c[0])).toEqual([3]);
  expect(found).toEqual([
    { posterPath: "/a.jpg", voteAverage: 8 },
    { posterPath: "/b.jpg", voteAverage: 6 },
    { posterPath: "/t.jpg", voteAverage: 9 },
  ]);
});

it("keeps the file's poster when the lookup fails, and counts final missing posters", async () => {
  movie.mockRejectedValue(notFound);
  const { found, missing } = await lookupImportPosters([
    { mediaId: 1, type: "movie", posterPath: "/a.jpg" },
    { mediaId: 2, type: "movie" },
  ]);
  expect(found).toEqual([{ posterPath: "/a.jpg", voteAverage: undefined }, { posterPath: null, voteAverage: undefined }]);
  expect(missing).toBe(1);
});

// data-backup: each title is looked up once per import, and counted once.
it("looks a title up once however many rows carry it, and counts it once", async () => {
  movie.mockResolvedValue({ data: { poster_path: null, vote_average: 5 } });
  const progress = jest.fn();
  const { found, missing } = await lookupImportPosters(
    [
      { mediaId: 1, type: "movie" },
      { mediaId: 1, type: "movie", voteAverage: 3 },
      { mediaId: 1, type: "movie" },
      { mediaId: 1, type: "tv" },
    ],
    progress,
  );
  expect(movie.mock.calls.map((c) => c[0])).toEqual([1]);
  expect(tv.mock.calls.map((c) => c[0])).toEqual([1]);
  expect(found).toEqual([
    { posterPath: null, voteAverage: 5 },
    { posterPath: null, voteAverage: 3 },
    { posterPath: null, voteAverage: 5 },
    { posterPath: "/t.jpg", voteAverage: 7 },
  ]);
  expect(missing).toBe(1);
  expect(progress).toHaveBeenLastCalledWith(2, 2);
});

it("keeps a row's own file poster within a looked-up title", async () => {
  const { found, missing } = await lookupImportPosters([
    { mediaId: 1, type: "movie", posterPath: "/own.jpg" },
    { mediaId: 1, type: "movie" },
  ]);
  expect(movie).toHaveBeenCalledTimes(1);
  expect(found).toEqual([{ posterPath: "/own.jpg", voteAverage: 6 }, { posterPath: "/m.jpg", voteAverage: 6 }]);
  expect(missing).toBe(0);
});
