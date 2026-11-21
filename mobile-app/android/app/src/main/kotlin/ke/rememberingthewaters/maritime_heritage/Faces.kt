package ke.rememberingthewaters.maritime_heritage

import android.content.Context
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * Finds faces in a photo so the app can blur them before it is sent ("Blur faces in the photos I add next").
 * Uses Google's on-device face detection through Google Play services: nothing leaves the phone, and the model
 * is downloaded once by Play services (see the DEPENDENCIES meta-data in the manifest).
 * Answers a list of [left, top, width, height] boxes in the photo's pixels, or an error the app reports to the person.
 */
object Faces {
    private val detector by lazy {
        FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
                .setMinFaceSize(0.04f)
                .build()
        )
    }

    fun find(context: Context, path: String, result: MethodChannel.Result) {
        val image = try {
            InputImage.fromFilePath(context, Uri.fromFile(File(path)))
        } catch (e: Exception) {
            result.error("unreadable", e.message, null)
            return
        }
        detector.process(image)
            .addOnSuccessListener { faces ->
                result.success(faces.map { f -> listOf(f.boundingBox.left, f.boundingBox.top, f.boundingBox.width(), f.boundingBox.height()) })
            }
            .addOnFailureListener { e -> result.error("unavailable", e.message, null) }
    }
}
