import fs from "fs";

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    fileType: "STL" | "OBJ" | "UNKNOWN";
    fileSize: number;
    volume?: number;
    surfaceArea?: number;
  };
}

export class FileValidationService {
  private static MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static ALLOWED_EXTENSIONS = [".stl", ".obj"];

  /**
   * Validate uploaded 3D file for structure, safety, and metadata.
   */
  public async validateFile(
    filePath: string,
    originalName: string,
    fileSize: number
  ): Promise<ValidationReport> {
    const report: ValidationReport = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        fileType: "UNKNOWN",
        fileSize,
      },
    };

    // 1. Basic checks
    if (fileSize > FileValidationService.MAX_FILE_SIZE) {
      report.isValid = false;
      report.errors.push(`File is too large. Max size is 50MB.`);
    }

    const lowerName = originalName.toLowerCase();
    const ext = FileValidationService.ALLOWED_EXTENSIONS.find((e) =>
      lowerName.endsWith(e)
    );
    if (!ext) {
      report.isValid = false;
      report.errors.push(`Invalid extension. Allowed: .stl, .obj`);
      return report;
    }

    report.metadata!.fileType = ext === ".stl" ? "STL" : "OBJ";

    // 2. Malware & Structure check via magic numbers/header parsing
    try {
      const buffer = fs.readFileSync(filePath);

      if (report.metadata!.fileType === "STL") {
        this.validateSTLStructure(buffer, report);
      } else if (report.metadata!.fileType === "OBJ") {
        this.validateOBJStructure(buffer, report);
      }
    } catch (e: any) {
      report.isValid = false;
      report.errors.push(`Failed to read or parse file: ${e.message}`);
    }

    if (report.errors.length > 0) report.isValid = false;

    return report;
  }

  /**
   * Validates STL file integrity and identifies whether it is ASCII or Binary.
   */
  private validateSTLStructure(buffer: Buffer, report: ValidationReport) {
    if (buffer.length < 84) {
      report.isValid = false;
      report.errors.push("STL file is too small to be valid.");
      return;
    }

    // Heuristics to check binary vs ascii
    // ASCII STLs usually start with 'solid '
    const headerString = buffer.subarray(0, 6).toString("ascii").toLowerCase();
    const isAscii = headerString.startsWith("solid ");

    if (isAscii) {
      // Basic check for ASCII STL ending
      const lastBytes = buffer
        .subarray(Math.max(0, buffer.length - 200))
        .toString("ascii")
        .toLowerCase();
      if (!lastBytes.includes("endsolid")) {
        report.warnings.push(
          "ASCII STL might be truncated. Could not consistently find 'endsolid' near EOF."
        );
      }
    } else {
      // Binary STL Check
      // Standard Binary STL has 80 bytes header, then 4 bytes integer (number of triangles)
      const numTriangles = buffer.readUInt32LE(80);
      const expectedSize = 84 + numTriangles * 50;

      if (buffer.length !== expectedSize) {
        report.errors.push(
          `Binary STL corrupted. Expected size ${expectedSize} bytes based on ${numTriangles} triangles, but got ${buffer.length} bytes.`
        );
      }
    }
  }

  /**
   * Validates OBJ files
   */
  private validateOBJStructure(buffer: Buffer, report: ValidationReport) {
    // OBJ files are plain text.
    // Basic malware check: ensure file doesn't contain null bytes (which a raw text file shouldn't have)
    const MAX_PEEK = Math.min(1024, buffer.length);
    for (let i = 0; i < MAX_PEEK; i++) {
      if (buffer[i] === 0x00) {
        report.isValid = false;
        report.errors.push(
          "OBJ file appears to be a binary file, which violates the OBJ text structure."
        );
        return;
      }
    }

    // Basic heuristic: should have 'v ' (vertex) or '#' (comment)
    const content = buffer.subarray(0, MAX_PEEK).toString("ascii");
    if (!content.includes("v ") && !content.includes("#")) {
      report.warnings.push(
        "OBJ file lacks standard vertex ('v ') or comment ('#') definitions in header."
      );
    }
  }
}

export const fileValidationService = new FileValidationService();
